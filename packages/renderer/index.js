import { EventBus } from '@platinum/core';
const vertexWGSL = `@vertex fn vs(@builtin(vertex_index) i:u32)->@builtin(position) vec4f { var v=array<vec2f,3>(vec2f(-1,-1),vec2f(3,-1),vec2f(-1,3)); return vec4f(v[i],0,1); }`;
const fragmentWGSL = `struct Params { size:vec2f, scale:f32, mode:f32, color:vec4f, tile:vec2f, brightness:f32, pad:f32 }; @group(0) @binding(0) var<uniform> p:Params; @group(0) @binding(1) var picture:texture_2d<f32>; @group(0) @binding(2) var sampling:sampler;
@fragment fn fs(@builtin(position) position:vec4f)->@location(0) vec4f {
let xy=position.xy/p.scale;var color=p.color.rgb;
if(p.mode<0.5){color=textureSample(picture,sampling,fract(xy/p.tile)).rgb;}
else if(p.mode<1.5){let checker=(u32(floor(xy.x))+u32(floor(xy.y)))%2u;color=p.color.rgb*select(1.0,0.76,checker==0u);}
else if(p.mode<2.5){let line=fract(xy.y/4.0);color=p.color.rgb*select(1.0,0.86,line<0.25);}
else if(p.mode<3.5){let checker=(u32(floor(xy.x/8.0))+u32(floor(xy.y/8.0)))%2u;color=p.color.rgb*select(1.0,0.79,checker==0u);}
return vec4f(color*p.brightness,1);}`;
const fragmentGL = `#version 300 es
precision highp float;
uniform vec2 u_size;uniform float u_scale;uniform float u_mode;uniform vec4 u_color;uniform vec2 u_tile;uniform float u_brightness;uniform sampler2D u_texture;out vec4 outColor;
void main(){vec2 xy=vec2(gl_FragCoord.x,u_size.y-gl_FragCoord.y)/u_scale;vec3 c=u_color.rgb;if(u_mode<0.5)c=texture(u_texture,fract(xy/u_tile)).rgb;else if(u_mode<1.5)c*=mod(floor(xy.x)+floor(xy.y),2.0)<1.0?0.76:1.0;else if(u_mode<2.5)c*=fract(xy.y/4.0)<0.25?0.86:1.0;else if(u_mode<3.5)c*=mod(floor(xy.x/8.0)+floor(xy.y/8.0),2.0)<1.0?0.79:1.0;outColor=vec4(c*u_brightness,1.0);}`;
function rgb(hex) { const s = (hex || '#666699').replace('#', ''); return [parseInt(s.slice(0, 2), 16) / 255, parseInt(s.slice(2, 4), 16) / 255, parseInt(s.slice(4, 6), 16) / 255, 1]; }
/** Damage-driven texture compositor with independent WebGPU, WebGL2 and Canvas2D paths. */
export class SurfaceRenderer extends EventBus {
    constructor(host, { source = null, tile = [128, 128], mode = 0, color = '#666699', brightness = 1, preference = 'auto' } = {}) { super(); this.host = host; this.source = source; this.tile = tile; this.mode = mode; this.color = color; this.brightness = brightness; this.preference = preference; this.backend = 'initializing'; this.frame = 0; this.disposed = false; this.canvas = null; this.observer = new ResizeObserver(() => this.invalidate()); this.observer.observe(host); this.metrics = { frames: 0, lastFrameMS: 0 }; }
    async initialize() {
        if (!this.source) {
            const img = new Image();
            img.src = '/assets/platinum-desktop-reference.png';
            try {
                await img.decode();
                this.source = await createImageBitmap(img, 0, 20, 128, 128);
            }
            catch {
                const canvas = document.createElement('canvas');
                canvas.width = 1;
                canvas.height = 1;
                const ctx = canvas.getContext('2d');
                if (!ctx)
                    throw new Error('No Canvas 2D fallback context');
                ctx.fillStyle = this.color;
                ctx.fillRect(0, 0, 1, 1);
                this.source = canvas;
            }
        }
        if (this.disposed)
            return;
        const backends = this.preference === 'canvas2d' ? ['canvas2d'] : this.preference === 'webgl2' ? ['webgl2', 'canvas2d'] : ['webgpu', 'webgl2', 'canvas2d'];
        for (const backend of backends) {
            if (this.disposed)
                return;
            try {
                this.replaceCanvas();
                if (backend === 'webgpu')
                    await this.initGPU();
                else if (backend === 'webgl2')
                    this.initGL();
                else
                    this.context = this.canvas.getContext('2d', { alpha: false });
                if (this.disposed)
                    return;
                if (!this.context)
                    throw new Error('No canvas context');
                this.backend = backend;
                this.emit('backend', backend);
                this.invalidate();
                return this;
            }
            catch (error) {
                this.release();
                if (this.disposed)
                    return;
                this.emit('fallback', { backend, reason: error.message });
            }
        }
        throw new Error('No graphics backend is available.');
    }
    replaceCanvas() { this.canvas?.remove(); this.canvas = document.createElement('canvas'); this.canvas.className = 'renderer-surface'; this.canvas.setAttribute('aria-hidden', 'true'); this.host.prepend(this.canvas); }
    async initGPU() {
        if (!navigator.gpu)
            throw new Error('WebGPU unavailable');
        const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'low-power' });
        if (!adapter)
            throw new Error('No WebGPU adapter');
        const device = await adapter.requestDevice();
        if (this.disposed) {
            device.destroy();
            return;
        }
        this.device = device;
        this.context = this.canvas.getContext('webgpu');
        if (!this.context)
            throw new Error('No WebGPU canvas');
        this.format = navigator.gpu.getPreferredCanvasFormat();
        this.context.configure({ device, format: this.format, alphaMode: 'opaque' });
        device.pushErrorScope('validation');
        this.pipeline = await device.createRenderPipelineAsync({ layout: 'auto', vertex: { module: device.createShaderModule({ code: vertexWGSL }), entryPoint: 'vs' }, fragment: { module: device.createShaderModule({ code: fragmentWGSL }), entryPoint: 'fs', targets: [{ format: this.format }] }, primitive: { topology: 'triangle-list' } });
        if (this.disposed) {
            device.destroy();
            return;
        }
        this.uniform = device.createBuffer({ size: 48, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
        this.sampler = device.createSampler({ magFilter: 'nearest', minFilter: 'nearest' });
        this.uploadGPU();
        const error = await device.popErrorScope();
        if (error)
            throw new Error(error.message);
        device.addEventListener('uncapturederror', event => { event.preventDefault(); this.recover('webgl2', event.error.message); });
        device.lost.then(info => { if (this.disposed || info.reason === 'destroyed')
            return; this.emit('fallback', { backend: 'webgpu', reason: info.message }); this.recover('webgl2', info.message); });
    }
    uploadGPU() { const device = this.device; const width = this.source.width || this.source.naturalWidth, height = this.source.height || this.source.naturalHeight; if (!width || !height)
        return; if (!this.texture || this.texture.width !== width || this.texture.height !== height) {
        this.texture?.destroy();
        this.texture = device.createTexture({ size: [width, height], format: 'rgba8unorm', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT });
        this.bindGroup = device.createBindGroup({ layout: this.pipeline.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: this.uniform } }, { binding: 1, resource: this.texture.createView() }, { binding: 2, resource: this.sampler }] });
    } device.queue.copyExternalImageToTexture({ source: this.source }, { texture: this.texture }, { width, height }); }
    initGL() { const gl = this.canvas.getContext('webgl2', { alpha: false, antialias: false, preserveDrawingBuffer: false }); if (!gl)
        throw new Error('WebGL2 unavailable'); this.context = gl; const compile = (type, code) => { const shader = gl.createShader(type); gl.shaderSource(shader, code); gl.compileShader(shader); if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
        throw new Error(gl.getShaderInfoLog(shader)); return shader; }; const v = compile(gl.VERTEX_SHADER, '#version 300 es\nvoid main(){vec2 p[3]=vec2[3](vec2(-1,-1),vec2(3,-1),vec2(-1,3));gl_Position=vec4(p[gl_VertexID],0,1);}'); const f = compile(gl.FRAGMENT_SHADER, fragmentGL); const program = gl.createProgram(); gl.attachShader(program, v); gl.attachShader(program, f); gl.linkProgram(program); gl.deleteShader(v); gl.deleteShader(f); if (!gl.getProgramParameter(program, gl.LINK_STATUS))
        throw new Error(gl.getProgramInfoLog(program)); this.program = program; gl.useProgram(program); this.locations = Object.fromEntries(['size', 'scale', 'mode', 'color', 'tile', 'brightness', 'texture'].map(n => [n, gl.getUniformLocation(program, `u_${n}`)])); this.glTexture = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, this.glTexture); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT); this.uploadGL(); this.canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); if (!this.disposed) {
        this.recover('canvas2d', 'WebGL context lost');
    } }); }
    uploadGL() { const gl = this.context; gl.bindTexture(gl.TEXTURE_2D, this.glTexture); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.source); }
    updateSource(source) { this.source = source; this.pattern = null; if (this.backend === 'webgpu')
        this.uploadGPU();
    else if (this.backend === 'webgl2')
        this.uploadGL(); this.invalidate(); }
    set(options) { Object.assign(this, options); this.pattern = null; this.invalidate(); }
    invalidate() { if (this.disposed || this.frame)
        return; this.frame = requestAnimationFrame(() => { this.frame = 0; this.draw(); }); }
    draw() {
        if (this.disposed || !this.context || this.backend === 'initializing')
            return;
        const start = performance.now();
        const dpr = Math.min(devicePixelRatio || 1, 2), width = Math.max(1, Math.round(this.host.clientWidth * dpr)), height = Math.max(1, Math.round(this.host.clientHeight * dpr));
        if (this.canvas.width !== width || this.canvas.height !== height) {
            this.canvas.width = width;
            this.canvas.height = height;
        }
        const color = rgb(this.color);
        if (this.backend === 'webgpu') {
            const values = new Float32Array([width, height, dpr, this.mode, ...color, ...this.tile, this.brightness, 0]);
            this.device.queue.writeBuffer(this.uniform, 0, values);
            const encoder = this.device.createCommandEncoder();
            const pass = encoder.beginRenderPass({ colorAttachments: [{ view: this.context.getCurrentTexture().createView(), loadOp: 'clear', storeOp: 'store', clearValue: { r: 0, g: 0, b: 0, a: 1 } }] });
            pass.setPipeline(this.pipeline);
            pass.setBindGroup(0, this.bindGroup);
            pass.draw(3);
            pass.end();
            this.device.queue.submit([encoder.finish()]);
        }
        else if (this.backend === 'webgl2') {
            const gl = this.context, l = this.locations;
            gl.viewport(0, 0, width, height);
            gl.useProgram(this.program);
            gl.uniform2f(l.size, width, height);
            gl.uniform1f(l.scale, dpr);
            gl.uniform1f(l.mode, this.mode);
            gl.uniform4fv(l.color, color);
            gl.uniform2f(l.tile, ...this.tile);
            gl.uniform1f(l.brightness, this.brightness);
            gl.drawArrays(gl.TRIANGLES, 0, 3);
        }
        else {
            const ctx = this.context;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.imageSmoothingEnabled = false;
            ctx.fillStyle = this.color;
            ctx.fillRect(0, 0, width / dpr, height / dpr);
            if (this.mode === 0 && this.source) {
                if (!this.pattern) {
                    const tile = document.createElement('canvas');
                    tile.width = this.tile[0];
                    tile.height = this.tile[1];
                    const c = tile.getContext('2d');
                    c.imageSmoothingEnabled = false;
                    c.drawImage(this.source, 0, 0, ...this.tile);
                    this.pattern = ctx.createPattern(tile, 'repeat');
                }
                ctx.fillStyle = this.pattern;
                ctx.fillRect(0, 0, width / dpr, height / dpr);
            }
            else if (this.mode > 0 && this.mode < 4) {
                const tile = document.createElement('canvas'), size = this.mode === 1 ? 2 : this.mode === 2 ? 4 : 16;
                tile.width = tile.height = size;
                const c = tile.getContext('2d');
                c.fillStyle = this.color;
                c.fillRect(0, 0, size, size);
                c.fillStyle = this.mode === 2 ? 'rgba(0,0,0,.14)' : this.mode === 1 ? 'rgba(0,0,0,.24)' : 'rgba(0,0,0,.21)';
                if (this.mode === 2)
                    c.fillRect(0, 0, 4, 1);
                else {
                    const half = size / 2;
                    c.fillRect(0, 0, half, half);
                    c.fillRect(half, half, half, half);
                }
                ctx.fillStyle = ctx.createPattern(tile, 'repeat');
                ctx.fillRect(0, 0, width / dpr, height / dpr);
            }
            if (this.brightness < 1) {
                ctx.fillStyle = `rgba(0,0,0,${1 - this.brightness})`;
                ctx.fillRect(0, 0, width / dpr, height / dpr);
            }
        }
        this.metrics.frames++;
        this.metrics.lastFrameMS = performance.now() - start;
    }
    async recover(preference, reason) { if (this.disposed || this.recovering)
        return; this.recovering = true; this.emit('fallback', { backend: this.backend, reason }); this.preference = preference; this.release(); try {
        await this.initialize();
    }
    catch (error) {
        this.emit('error', error);
    }
    finally {
        this.recovering = false;
    } }
    release() { this.texture?.destroy(); this.uniform?.destroy(); this.device?.destroy(); this.texture = null; this.uniform = null; this.device = null; this.context = null; }
    dispose() { this.disposed = true; cancelAnimationFrame(this.frame); this.observer.disconnect(); this.release(); this.canvas?.remove(); this.clear(); }
}
export function patternOptions(name, color) { return name === 'macos' ? { mode: 0, tile: [128, 128] } : name === 'gray' ? { mode: 1, color: '#aaaaaa' } : name === 'teal' ? { mode: 1, color: '#3c9292' } : name === 'pinstripes' ? { mode: 2, color: '#7777aa' } : name === 'checker' ? { mode: 3, color: '#8888bb' } : name === 'black' ? { mode: 4, color: '#111111' } : name === 'white' ? { mode: 4, color: '#ffffff' } : { mode: 4, color: color || '#666699' }; }
