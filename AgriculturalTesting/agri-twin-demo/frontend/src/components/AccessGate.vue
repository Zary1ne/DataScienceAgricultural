<template>
  <div class="gate" :class="{ open }" aria-hidden="true">
    <div class="half left">
      <span class="mesh"></span>
      <span class="rivets"></span>
      <span class="sheen"></span>
    </div>
    <div class="half right">
      <span class="mesh"></span>
      <span class="rivets"></span>
      <span class="sheen"></span>
    </div>

    <div class="emblem-clip left-clip">
      <div class="emblem-holder"><BrandEmblem :size="176" /></div>
    </div>
    <div class="emblem-clip right-clip">
      <div class="emblem-holder"><BrandEmblem :size="176" /></div>
    </div>

    <div class="seam"></div>
    <div class="seam-flare"></div>
  </div>
</template>

<script setup>
import BrandEmblem from "./BrandEmblem.vue";

defineProps({
  open: { type: Boolean, default: false },
});
</script>

<style scoped>
.gate {
  position: fixed;
  inset: 0;
  z-index: 900;
  overflow: hidden;
  pointer-events: all;
}

.half {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 100%;
  background: linear-gradient(128deg, #454b54 0%, #262b32 34%, #3d444e 62%, #171b21 100%);
  transition: transform 0.92s cubic-bezier(0.66, 0, 0.18, 1), filter 0.92s ease;
  will-change: transform;
}

.half.left {
  left: 0;
  clip-path: polygon(0 0, 53.5% 0, 46.5% 100%, 0 100%);
}

.half.right {
  right: 0;
  clip-path: polygon(53.5% 0, 100% 0, 100% 100%, 46.5% 100%);
}

.mesh {
  position: absolute;
  inset: 0;
  background-image: repeating-linear-gradient(
      45deg,
      rgba(255, 255, 255, 0.055) 0 1px,
      transparent 1px 8px
    ),
    repeating-linear-gradient(-45deg, rgba(0, 0, 0, 0.32) 0 1px, transparent 1px 8px);
  mask-image: radial-gradient(circle at 50% 50%, #000 0, rgba(0, 0, 0, 0.75) 70%, transparent 100%);
}

.rivets {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 64px;
  background-image: radial-gradient(circle, rgba(255, 255, 255, 0.55) 0 1.6px, rgba(0, 0, 0, 0.55) 1.8px 3px, transparent 3.4px);
  background-size: 22px 44px;
  background-repeat: repeat-y;
  opacity: 0.55;
}

.half.left .rivets {
  right: 26%;
}

.half.right .rivets {
  left: 26%;
}

.sheen {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    118deg,
    transparent 32%,
    rgba(255, 255, 255, 0.18) 46%,
    rgba(255, 255, 255, 0.04) 54%,
    transparent 68%
  );
  opacity: 0;
  transition: opacity 0.5s ease;
}

.emblem-clip {
  position: absolute;
  inset: 0;
  overflow: hidden;
  transition: transform 0.92s cubic-bezier(0.66, 0, 0.18, 1), opacity 0.7s ease;
  will-change: transform;
}

.left-clip {
  clip-path: inset(0 50% 0 0);
}

.right-clip {
  clip-path: inset(0 0 0 50%);
}

.emblem-holder {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  filter: drop-shadow(0 0 42px rgba(232, 198, 110, 0.35));
}

.seam {
  position: absolute;
  top: -2%;
  bottom: -2%;
  left: 50%;
  width: 2px;
  background: linear-gradient(
    180deg,
    transparent,
    rgba(246, 226, 168, 0.85) 18%,
    rgba(255, 255, 255, 0.95) 50%,
    rgba(246, 226, 168, 0.85) 82%,
    transparent
  );
  box-shadow: 0 0 26px rgba(232, 198, 110, 0.55);
  transform: rotate(1.6deg);
  transform-origin: center;
  transition: opacity 0.35s ease;
}

.seam-flare {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 460px;
  height: 460px;
  margin: -230px 0 0 -230px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 236, 180, 0.55), transparent 62%);
  opacity: 0;
  transform: scale(0.4);
  pointer-events: none;
}

/* —— 拉开 —— */
.gate.open .half.left {
  transform: translateX(-118%);
  filter: brightness(1.12);
}

.gate.open .half.right {
  transform: translateX(118%);
  filter: brightness(1.12);
}

.gate.open .left-clip {
  transform: translateX(-118%) rotate(-6deg);
  opacity: 0;
}

.gate.open .right-clip {
  transform: translateX(118%) rotate(6deg);
  opacity: 0;
}

.gate.open .sheen {
  opacity: 1;
}

.gate.open .seam {
  opacity: 0;
}

.gate.open .seam-flare {
  animation: seam-flare 0.85s ease-out forwards;
}

@keyframes seam-flare {
  0% {
    opacity: 0.9;
    transform: scale(0.3);
  }
  60% {
    opacity: 0.5;
    transform: scale(1);
  }
  100% {
    opacity: 0;
    transform: scale(1.25);
  }
}

@media (prefers-reduced-motion: reduce) {
  .half,
  .emblem-clip {
    transition-duration: 0.01ms;
  }
}
</style>
