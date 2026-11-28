// Coordinates are measured in the 320 × 320 reference view of orchard-apple.webp.
// Keeping UVs in this space preserves the skin and leaf veins at the default angle.
const outline = [
  118,116,116,115,115,115,114,115,116,116,118,119,121,121,123,123,124,123,
  124,124,124,124,125,124,122,121,119,118,116,115,116,116,116,117,118,118,
  119,119,121,121,121,123,122,122,123,123,123,122,120,118,117,116,116,114,
  114,113,114,115,115,117,119,121,122,123,123,123,122,123,121,121,120,118
];
const leafEdges = [
  [186,57,58],[191,49,60],[195,41,61],[199,35,64],[203,30,66],[207,26,68],
  [211,22,69],[215,19,71],[219,16,72],[223,14,73],[227,13,74],[231,11,74],
  [235,10,74],[239,9,74],[243,9,74],[247,9,73],[251,9,72],[255,10,71],
  [259,11,70],[263,12,69],[267,13,67],[271,16,65],[275,18,63],[279,20,60],
  [283,21,56],[287,20,51],[291,20,44],[295,18,32],[299,15,21],[302,13,14]
];

function appleMesh() {
  const vertices = [], indices = [];
  function surface(rows, cols, vertex) {
    const start = vertices.length / 9;
    for (let row = 0; row <= rows; row++) {
      for (let col = 0; col <= cols; col++) {
        vertices.push(...vertex(row, col));
        if (row && col) {
          const i = start + row * (cols + 1) + col, above = i - cols - 1;
          indices.push(above - 1, above, i, above - 1, i, i - 1);
        }
      }
    }
  }
  // Sweep the measured silhouette around the viewing axis to build a closed fruit.
  surface(44, outline.length, (row, col) => {
    const a = col * 2 * Math.PI / outline.length, lat = row * Math.PI / 44;
    const radius = outline[col % outline.length], radial = Math.sin(lat);
    const nx = Math.cos(a) * radial, ny = Math.sin(a) * radial, nz = Math.cos(lat);
    const x = 148 + radius * nx, y = 184 + radius * ny;
    const u = 148 + radius * nx * .985;
    const v = 184 + radius * ny * .985;
    return [x,y,109*nz, nx,-ny,nz, u/320,v/320,0];
  });
  // Two tapered, round sections connect the dimple to the curved leaf midrib.
  function branch(path) {
    surface(path.length-1, 16, (row,col) => {
      const [x,y,z,r] = path[row], angle = col * Math.PI / 8;
      const next = path[Math.min(row+1,path.length-1)], prev = path[Math.max(0,row-1)];
      const dx = next[0]-prev[0], dy = next[1]-prev[1], len = Math.hypot(dx,dy);
      const nx = -dy/len * Math.sin(angle), ny = dx/len * Math.sin(angle), nz = Math.cos(angle);
      return [x+nx*r,y+ny*r,z+nz*r, nx,-ny,nz, (x+nx*r*.75)/320,(y+ny*r*.75)/320,1];
    });
  }
  branch([[147,112,81,2.3],[148,106,84,3.6],[150,96,80,3.5],[154,84,73,3.4],
    [159,74,64,3.8],[165,64,55,3.9],[172,56,47,4],[178,52,44,3.3],[180,51,44,1]]);
  branch([[170,62,52,1.8],[178,59,49,1.7],[189,56,48,1.1]]);
  surface(leafEdges.length-1, 10, (row,col) => {
    const [x,top,bottom] = leafEdges[row], t = row/(leafEdges.length-1), v = col/10;
    const y = top + (bottom-top)*v, fold = Math.sin(t*Math.PI);
    const z = 48 - 37*t + fold*(16*Math.sin(Math.PI*v) - 14*(v-.5));
    return [x,y,z, .25,fold*(v-.5)*1.6,.9, x/320,y/320,2];
  });
  return { vertices: new Float32Array(vertices), indices: new Uint16Array(indices) };
}

const vertexSource = `
  attribute vec3 p, n, material;
  uniform vec2 pose;
  varying vec3 normal, originalNormal, tex;
  void main() {
    float cy=cos(pose.x), sy=sin(pose.x), cx=cos(pose.y), sx=sin(pose.y);
    mat3 spin=mat3(cy,sx*sy,-cx*sy, 0.,cx,sx, sy,-sx*cy,cx*cy);
    vec3 point=vec3(p.x-148.,184.-p.y,p.z);
    vec3 turned=spin*point;
    float w=1.+(point.z-turned.z)/680.;
    gl_Position=vec4((turned.xy+vec2(-12.,-24.))/162.,-turned.z/360.,w);
    normal=spin*n; originalNormal=n; tex=material;
  }`;
const fragmentSource = `
  precision mediump float;
  varying vec3 normal, originalNormal, tex;
  uniform sampler2D artwork;
  void main() {
    vec2 uv=tex.xy;
    if(tex.z>.5 && tex.z<1.5) uv-=vec2(128.,42.)/320.;
    vec4 paint=texture2D(artwork,uv);
    if(tex.z>.5 && tex.z<1.5 && paint.a<.85) paint=vec4(.34,.25,.095,1.);
    if(paint.a<.18) discard;
    vec3 N=normalize(normal), rest=normalize(originalNormal);
    vec3 light=normalize(vec3(-.56,.68,.76));
    vec3 halfVector=normalize(light+vec3(0.,0.,1.));
    float gain=.38*(dot(N,light)-dot(rest,light));
    float gloss=pow(max(dot(N,halfVector),0.),31.)-pow(max(dot(rest,halfVector),0.),31.);
    float edge=pow(1.-abs(N.z),3.)*max(N.x,0.);
    vec3 color=paint.rgb*(1.+gain) + vec3(.29,.24,.23)*gloss*(tex.z<.5?1.:.32)
       + vec3(.11,.17,.20)*edge;
    gl_FragColor=vec4(clamp(color,0.,1.),1.);
  }`;

// Keep the original stalk in an unused transparent corner of the texture. Fill its narrow
// footprint on the peel once, so turning the fruit reveals skin beneath the physical stalk.
function materialTexture(picture) {
  const sheet=document.createElement('canvas');
  sheet.width=sheet.height=1024;
  const ctx=sheet.getContext('2d', {willReadFrequently:true});
  ctx.drawImage(picture,0,0,1024,1024);
  const scale=1024/320;
  ctx.drawImage(sheet,128*scale,42*scale,68*scale,76*scale,0,0,68*scale,76*scale);
  const l=Math.floor(133*scale), t=Math.floor(66*scale);
  const patch=ctx.getImageData(l,t,Math.ceil(45*scale),Math.ceil(48*scale));
  const raw=patch.data.slice();
  for(let row=0;row<patch.height;row++) {
    const py=(row+t)/scale, d=112-py;
    const cx=148+.09*d+.0063*d*d, radius=6.3;
    const sampleRow=Math.max(row,Math.ceil(74*scale)-t);
    const left=4*(sampleRow*patch.width+Math.round((cx-radius-1)*scale)-l);
    const right=4*(sampleRow*patch.width+Math.round((cx+radius+1)*scale)-l);
    for(let col=0;col<patch.width;col++) {
      const dx=(col+l)/scale-cx;
      if(Math.abs(dx)>radius || py>112.5) continue;
      const mix=.5+dx/(2*radius);
      const weight=Math.min(1,radius-Math.abs(dx))*Math.min(1,112.5-py);
      const offset=4*(row*patch.width+col);
      for(let k=0;k<4;k++) {
        const restored=raw[left+k]*(1-mix)+raw[right+k]*mix;
        patch.data[offset+k]=raw[offset+k]*(1-weight)+restored*weight;
      }
    }
  }
  ctx.putImageData(patch,l,t);
  return sheet;
}

export async function createAppleRenderer(canvas, imageURL) {
  const picture = new Image();
  picture.src = imageURL;
  await picture.decode();
  const gl = canvas.getContext('webgl', { alpha:true, antialias:true, premultipliedAlpha:true,
    powerPreference:'low-power', preserveDrawingBuffer:false });
  if (!gl) return null;
  function shader(type, source) {
    const unit = gl.createShader(type);
    gl.shaderSource(unit, source);
    gl.compileShader(unit);
    if (!gl.getShaderParameter(unit, gl.COMPILE_STATUS)) throw Error('Apple shader unavailable');
    return unit;
  }
  const program = gl.createProgram();
  gl.attachShader(program, shader(gl.VERTEX_SHADER,vertexSource));
  gl.attachShader(program, shader(gl.FRAGMENT_SHADER,fragmentSource));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program,gl.LINK_STATUS)) throw Error('Apple material unavailable');
  gl.useProgram(program);
  const {vertices,indices} = appleMesh();
  gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER,vertices,gl.STATIC_DRAW);
  for (const [i,name] of ['p','n','material'].entries()) {
    const location=gl.getAttribLocation(program,name);
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location,3,gl.FLOAT,false,36,i*12);
  }
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,gl.createBuffer());
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,indices,gl.STATIC_DRAW);
  gl.bindTexture(gl.TEXTURE_2D,gl.createTexture());
  // Mipmaps keep the skin and veins quiet when the fruit shrinks to the mobile report header.
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,materialTexture(picture));
  gl.generateMipmap(gl.TEXTURE_2D);
  for (const axis of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T]) gl.texParameteri(gl.TEXTURE_2D,axis,gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  const pose=gl.getUniformLocation(program,'pose');
  gl.enable(gl.DEPTH_TEST);
  gl.clearColor(0,0,0,0);
  return (yaw,pitch,size) => {
    if (gl.isContextLost()) return false;
    if (canvas.width!==size || canvas.height!==size) {
      canvas.width=canvas.height=size;
      gl.viewport(0,0,size,size);
    }
    gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    gl.uniform2f(pose,yaw,pitch);
    gl.drawElements(gl.TRIANGLES,indices.length,gl.UNSIGNED_SHORT,0);
    return true;
  };
}
