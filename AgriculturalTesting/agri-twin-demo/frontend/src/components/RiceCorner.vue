<template>
  <span class="rice-corner" aria-hidden="true">
    <i
      v-for="(c, i) in cells"
      :key="i"
      :style="{
        left: c.x + 'px',
        top: c.y + 'px',
        width: c.s + 'px',
        height: c.s + 'px',
        opacity: c.o,
        animationDelay: i * 0.22 + 's',
      }"
    ></i>
  </span>
</template>

<script setup>
// 右下角的小尺寸金色水稻角标：只用 7 个方块，不塞字母
const cells = [
  { x: 30, y: 4, s: 5, o: 0.95 },
  { x: 38, y: 10, s: 6, o: 0.85 },
  { x: 24, y: 13, s: 6, o: 0.9 },
  { x: 32, y: 19, s: 7, o: 1 },
  { x: 18, y: 23, s: 5, o: 0.8 },
  { x: 8, y: 33, s: 4, o: 0.65 },
];
</script>

<style scoped>
.rice-corner {
  position: absolute;
  right: 20px;
  bottom: 20px;
  width: 52px;
  height: 42px;
  pointer-events: none;
  transform: rotate(-8deg);
}

.rice-corner i {
  position: absolute;
  display: block;
  border-radius: 2px;
  background: linear-gradient(135deg, #fbeecb, #e2bd6d 46%, #b1852f 100%);
  box-shadow: 0 0 10px rgba(232, 198, 110, 0.35);
  animation: corner-breathe 5.6s ease-in-out infinite;
}

@keyframes corner-breathe {
  0%,
  100% {
    transform: translateY(0);
    filter: brightness(1);
  }
  50% {
    transform: translateY(-1.5px);
    filter: brightness(1.15);
  }
}

@media (prefers-reduced-motion: reduce) {
  .rice-corner i {
    animation: none;
  }
}
</style>
