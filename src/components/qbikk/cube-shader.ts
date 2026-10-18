// Shader for the QBIKK AI orb (the pastel soft cube). Shared by QbikkSection and the
// offscreen OrbSource used by the studio WebGL renderer.

export const CUBE_VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0., 1.); }`;
export const CUBE_FRAG = `
precision highp float;
uniform vec2  uRes;
uniform float uTime;
uniform mat3  uRot;
uniform vec3  uSquash;
uniform float uLevel;
uniform float uEnergy;
uniform float uProc;
uniform float uBloom;
uniform float uScale;
uniform vec3  uBg;
uniform float uDark;

float hash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x*p.y); }

float sdRoundBox(vec3 p, vec3 b, float r){
  vec3 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - r;
}

vec3 warp(vec3 p){
  float t = uTime;
  float a = 0.062 + 0.12*uLevel*uEnergy + 0.02*uEnergy;
  p += a*vec3(
    sin(p.y*2.1 + t*0.90 + sin(p.z*1.3 + t*0.50)),
    sin(p.z*1.9 + t*1.10 + 1.7 + sin(p.x*1.7 - t*0.40)),
    sin(p.x*2.3 + t*0.80 + 3.1 + sin(p.y*1.5 + t*0.60)));
  p += a*0.38*vec3(sin(p.z*5.3 - t*2.1), sin(p.x*4.9 + t*1.7), sin(p.y*5.7 - t*1.9));
  return p;
}

// supernova ramp: cold blue shell -> teal -> green -> orange heart -> hot amber
vec3 nova(float s){
  vec3 c0 = vec3(0.165, 0.420, 1.000);
  vec3 c1 = vec3(0.122, 0.780, 0.859);
  vec3 c2 = vec3(0.298, 0.859, 0.522);
  vec3 c3 = vec3(1.000, 0.561, 0.220);
  vec3 c4 = vec3(1.000, 0.820, 0.520);
  s = clamp(s, 0.0, 1.0);
  if (s < 0.28) return mix(c0, c1, s/0.28);
  if (s < 0.55) return mix(c1, c2, (s - 0.28)/0.27);
  if (s < 0.82) return mix(c2, c3, (s - 0.55)/0.27);
  return mix(c3, c4, (s - 0.82)/0.18);
}

void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5*uRes) / uRes.y;
  vec3 ro = vec3(0.0, 0.0, 3.6);
  vec3 rd = normalize(vec3(uv, -0.92));

  float R = 2.2;
  float b = dot(ro, rd);
  float h = b*b - (dot(ro, ro) - R*R);

  vec3  acc = vec3(0.0);
  float A = 0.0;
  vec3  lightDir = normalize(vec3(-0.65, 0.7, 0.55));
  float grainT = floor(uTime*18.0);

  if (h > 0.0) {
    h = sqrt(h);
    float t0 = -b - h, t1 = -b + h;
    const int N = 80;
    float dt = 1.9/60.0;
    float t = t0 + dt*hash(gl_FragCoord.xy + grainT);
    float soft = 0.18 + 0.05*uEnergy;
    float sweep = mod(uTime*1.1, 3.2) - 1.6;

    for (int i = 0; i < N; i++) {
      vec3 p = ro + rd*t;
      vec3 q = warp((uRot*p) / (uScale*uSquash));
      float d = sdRoundBox(q, vec3(0.56), 0.22);

      float fill  = 1.0 - smoothstep(-0.4, soft, d);
      float shell = exp(-abs(d)*13.0) * (1.0 - smoothstep(-0.03, 0.12, d));
      float dens  = fill*0.5 + shell*1.3;

      if (dens > 0.002) {
        vec3 aq = abs(q) + 1e-4;
        vec3 w  = pow(aq / max(max(aq.x, aq.y), aq.z), vec3(9.0));
        w /= (w.x + w.y + w.z);
        vec3 nWorld = (sign(q)*w) * uRot;
        float lit = dot(normalize(nWorld + 1e-4), lightDir)*0.5 + 0.5;

        float depth = clamp(-d/0.52, 0.0, 1.0);
        float flow  = sin(dot(q, vec3(2.3, 1.7, -1.9)) + uTime*1.2 + 2.0*sin(q.y*2.5 - uTime*0.7));

        vec3 sx = step(0.0, q);
        vec3 fx = mix(vec3(0.30, 0.86, 0.52), vec3(1.00, 0.56, 0.22), sx.x);
        vec3 fy = mix(vec3(0.12, 0.78, 0.86), vec3(0.24, 0.47, 1.00), sx.y);
        vec3 fz = mix(vec3(0.20, 0.82, 0.66), vec3(0.23, 0.62, 1.00), sx.z);
        vec3 col = fx*w.x + fy*w.y + fz*w.z;
        float facing = clamp(dot(normalize(nWorld + 1e-4), -rd)*1.7 + 0.3, 0.0, 1.0);
        vec3 mist = mix(vec3(0.84, 0.90, 0.95), vec3(0.30, 0.42, 0.52), uDark);
        col = mix(mist, col, facing);
        col = mix(col, nova(0.3 + 0.25*flow), 0.18 + 0.2*depth);
        col = mix(col, vec3(1.0, 0.6, 0.25), 0.18*uLevel*uEnergy);
        col = mix(col, vec3(0.95, 0.97, 1.0), lit*lit*mix(0.26, 0.14, uDark)*(1.0 - depth*0.7));

        float vein = pow(1.0 - abs(sin(q.x*3.1 + 1.6*sin(q.y*2.4 + uTime*0.9) + q.z*1.3 + uTime*0.6)), 12.0);
        vec3 warm = vec3(1.0, 0.56, 0.22);
        col = mix(col, warm, vein*fill*(0.5 + 0.25*uEnergy));

        float m1 = max(max(w.x, w.y), w.z);
        col += smoothstep(0.66, 0.5, m1)*shell*vec3(0.10, 0.12, 0.14);

        col += uProc*exp(-pow((q.y - sweep)*5.0, 2.0))*vec3(0.12, 0.2, 0.28);
        col += uBloom*vec3(0.12, 0.08, 0.04);

        float k = 2.1*(0.85 + 0.5*uEnergy + 0.25*uBloom)*mix(1.0, 0.86, uDark);
        float a = 1.0 - exp(-dens*dt*k);
        acc += (1.0 - A)*a*col;
        A   += (1.0 - A)*a;

        float core = exp(-dot(q, q)*7.0);
        acc += (1.0 - 0.6*A)*core*vec3(1.0, 0.52, 0.18)*dt*(0.38 + 0.8*uLevel*uEnergy + 0.45*uBloom)*mix(0.75, 1.25, uDark);

        if (A > 0.97) break;
      }
      t += max(dt, (d - 0.32)*0.7);
      if (t > t1) break;
    }
  }

  float r2 = dot(uv, uv) / (0.34*0.34*uScale*uScale);
  float haloAmt = exp(-r2*1.6)*(0.14 + 0.2*uEnergy + 0.28*uLevel*uEnergy + 0.12*uBloom)*(1.0 - A)*mix(1.0, 1.8, uDark);
  haloAmt *= 1.0 - smoothstep(0.3, 0.5, length(uv));
  vec3 haloCol = nova(0.1 + 0.4*clamp(0.5 - uv.x*0.9 - uv.y*0.5, 0.0, 1.0));
  acc += haloCol*haloAmt;
  A = min(A + haloAmt, 1.0);

  float n = hash(gl_FragCoord.xy*0.73 + grainT*17.0) - 0.5;
  acc += n*mix(0.07, 0.085, uDark)*A;

  vec3 outc = uBg*(1.0 - A) + acc;
  outc += (hash(gl_FragCoord.xy + 3.1) - 0.5)/255.0;
  gl_FragColor = vec4(clamp(outc, 0.0, 1.0), 1.0);
}`;
