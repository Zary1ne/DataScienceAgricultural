import * as THREE from "three";

const NO_WIND = Object.freeze({
  uTime: { value: 0 },
  uWindSpeed: { value: 0 },
});

function growthMorphCode(partKey) {
  if (partKey === "leaves") {
    return `
float leafOpen = smoothstep(aPartPhase, min(aPartPhase + 0.075, 1.0), aGrowth);
float leafLift = smoothstep(aPartPhase + 0.01, min(aPartPhase + 0.19, 1.0), aGrowth);
float leafTip = clamp(aTip, 0.0, 1.0);
transformed.y = mix(0.045 + leafTip * 0.012, transformed.y, leafOpen);
transformed.xz *= mix(0.06, 1.0, leafLift);
float matureDroop = smoothstep(0.78, 1.0, aGrowth) * leafTip * leafTip;
transformed.y -= matureDroop * 0.11;
transformed.xz *= 1.0 + matureDroop * 0.08;`;
  }
  if (partKey === "tillerStems") {
    return `
float tillerOpen = smoothstep(aPartPhase, min(aPartPhase + 0.055, 1.0), aGrowth);
transformed.y *= mix(0.08, 1.0, tillerOpen);
transformed.xz *= mix(0.08, 1.0, tillerOpen);`;
  }
  if (partKey === "panicle") {
    return `
float headOpen = smoothstep(0.545, 0.615, aGrowth);
transformed.y = 1.04 + (transformed.y - 1.04) * mix(0.12, 1.0, headOpen);
transformed.xz *= mix(0.35, 1.0, headOpen);`;
  }
  if (partKey === "grains") {
    return `
float grainPlump = smoothstep(0.69, 0.92, aGrowth);
transformed.y = 1.07 + (transformed.y - 1.07) * mix(0.45, 1.0, grainPlump);
transformed.xz *= mix(0.72, 1.0, grainPlump);`;
  }
  return "";
}

export function createRicePartMaterial(partKey, options = {}) {
  const windUniforms = options.windUniforms || NO_WIND;
  const material = new THREE.MeshLambertMaterial({
    color: 0xffffff,
    vertexColors: true,
    side: THREE.DoubleSide,
  });
  const morphCode = growthMorphCode(partKey);

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = windUniforms.uTime;
    shader.uniforms.uWindSpeed = windUniforms.uWindSpeed;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <common>",
      `#include <common>
attribute float aVisible;
attribute float aPhase;
attribute float aSwayAmp;
attribute float aSwayWeight;
attribute float aGrowth;
attribute float aPartPhase;
attribute float aTip;
uniform float uTime;
uniform float uWindSpeed;`
    );
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
if (aVisible < 0.5) {
  gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  return;
}
${morphCode}
float riceSwayPhase = uTime * (1.4 + aSwayAmp) + aPhase;
float riceSway = sin(riceSwayPhase) * uWindSpeed * aSwayAmp * aSwayWeight * 0.045;
transformed.x += riceSway * max(transformed.y, 0.0);
transformed.z += cos(riceSwayPhase * 0.73) * riceSway * 0.36 * max(transformed.y, 0.0);`
    );
  };
  material.customProgramCacheKey = () => `rice-growth-${partKey}-v3`;
  return material;
}
