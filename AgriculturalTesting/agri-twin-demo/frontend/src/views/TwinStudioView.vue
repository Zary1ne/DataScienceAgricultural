<template>
  <div class="studio">
    <header class="studio-top">
      <button class="back-btn" @click="$router.push('/twin')">← 返回</button>
      <div class="studio-title">
        <span class="title-dot"></span>
        <span class="title-text">AgriTwin · 数字孪生农场实时监控</span>
        <span class="live-badge">LIVE</span>
        <span class="region-badge">{{ selectedRegion.short }} · {{ terrainLabel }}</span>
      </div>
      <div class="studio-clock num">{{ now }}</div>
    </header>

    <div class="studio-main" :class="{ 'is-plot-focused': selectedObj?.type === 'plot' }">
      <!-- 左侧：产区导航与环境摘要 -->
      <aside class="panel side-panel region-sidebar">
        <div class="region-panel">
          <div class="region-panel-head">
            <div>
              <span class="eyebrow">RICE REGIONS · HUNAN</span>
              <h2 class="panel-title">种植区域</h2>
            </div>
            <span class="region-count">双地块</span>
          </div>
          <div class="region-switcher">
            <button
              v-for="region in regionCatalog"
              :key="region.key"
              class="region-chip"
              :class="{ active: selectedRegion.key === region.key }"
              @click="selectedRegion = region"
            >
              <span class="region-chip-dot"></span>
              {{ region.short }}
            </button>
          </div>

          <!-- P3 布局重构：地形/气候/土壤/风险 → 折叠面板 -->
          <button class="accordion-toggle" type="button" @click="regionAccordionOpen = !regionAccordionOpen">
            <span class="accordion-toggle-label">产区详情</span>
            <span class="accordion-toggle-arrow" :class="{ open: regionAccordionOpen }">›</span>
          </button>
          <Transition name="accordion">
            <div v-if="regionAccordionOpen" class="region-summary">
              <div class="region-summary-name">{{ selectedRegion.name }}</div>
              <p class="region-description">{{ selectedRegion.description }}</p>
              <div class="terrain-summary">
                <span>地形特征</span>
                <strong>{{ selectedRegion.terrain }}</strong>
              </div>
              <ul>
                <li><span>气候</span><strong>{{ selectedRegion.climate }}</strong></li>
                <li><span>土壤</span><strong>{{ selectedRegion.soil }}</strong></li>
                <li><span>风险</span><strong>{{ selectedRegion.risk }}</strong></li>
              </ul>
              <div class="plot-structure-mini">
                <span>{{ PLOT_STRUCTURE.modelCount }} 地块模型 · {{ PLOT_STRUCTURE.zonesPerPlot }} 子区/块 · {{ PLOT_STRUCTURE.zoneSizeM }}m 格 · 总 {{ PLOT_STRUCTURE.totalSizeM }}m</span>
              </div>
            </div>
          </Transition>
        </div>

        <div class="weather-summary-head">
          <h2 class="panel-title">当前天气</h2>
          <div class="weather-head-right">
            <span class="weather-source-dot" :class="'is-' + actualWeatherStatus"></span>
            <button
              class="drawer-open-btn"
              type="button"
              title="打开天气设置"
              :class="{ active: weatherDrawerOpen }"
              @click="weatherDrawerOpen = !weatherDrawerOpen"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="15" height="15">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 0 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.6-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 0 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 0 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
              </svg>
              天气设置
            </button>
          </div>
        </div>
        <div class="weather-now">
          <span class="weather-emoji">{{ weatherEmoji }}</span>
          <div class="weather-now-copy">
            <span class="weather-label">{{ weatherLabel }}</span>
            <span class="weather-region">{{ selectedRegion.short }} · {{ weatherMode === "actual" ? weatherFreshnessLabel : "场景模拟" }}</span>
          </div>
          <span class="weather-mode-label">{{ weatherModeLabel }}</span>
        </div>

        <!-- P3 布局重构：土壤剖面从右侧搬至左侧，填补左下方空白 -->
        <div v-if="soilProfile.layers && soilProfile.layers.length" class="soil-profile">
          <div class="sp-head">
            <span>土壤剖面</span>
            <span class="sp-hint" v-if="isSoilWetting">💧 水分下渗中…</span>
            <span class="sp-depth-total num">0-{{ soilProfile.totalDepth }}cm</span>
          </div>
          <div class="sp-body">
            <div class="sp-stack" :class="{ 'is-wetting': isSoilWetting }">
              <div
                v-for="l in soilProfile.layers"
                :key="l.name"
                class="sp-layer"
                :class="{ 'is-wet': isSoilWetting }"
                :style="{ background: l.color, flex: l.to - l.from }"
              >
                <span class="wet-droplet" v-if="isSoilWetting"></span>
                <span class="wet-droplet delay-1" v-if="isSoilWetting"></span>
                <span class="wet-droplet delay-2" v-if="isSoilWetting"></span>
                <span class="wet-bar" :style="{ width: l.moisture + '%' }"></span>
              </div>
            </div>
            <div class="sp-list">
              <div v-for="l in soilProfile.layers" :key="l.name" class="sp-item">
                <div class="sp-name-row">
                  <i class="sp-swatch" :style="{ background: l.color }"></i>
                  <span class="sp-name">{{ l.name }}</span>
                  <span class="sp-range num">{{ l.from }}-{{ l.to }}cm</span>
                </div>
                <div class="sp-vals num">
                  {{ l.texture }} · 含水率 <TransitionNum :value="l.moisture" :decimals="0" class="num-inline" />% · <TransitionNum :value="l.temp" :decimals="0" class="num-inline" />°C · pH <TransitionNum :value="l.ph" :decimals="1" class="num-inline" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <!-- 中间：3D 场景 -->
      <main class="scene-wrap">
        <TwinScene
          ref="sceneRef"
          :plot-states="plotStates"
          :weather="weather"
          :weather-snapshot="weatherSnapshot"
          :component-manager="componentManager"
          :harvest-amount="harvestAmount"
          @select="onSelect"
          @component-select="onComponentSelect"
          @ground-click="onGroundClick"
          @view-change="sceneView = $event"
        />
        <div class="scan-line"></div>
        <div class="scene-view-switch" role="group" aria-label="3D 场景取景区域">
          <button
            v-for="view in sceneViewOptions"
            :key="view.key"
            type="button"
            :class="{ active: sceneView === view.key }"
            @click="setSceneView(view.key)"
          >{{ view.label }}</button>
        </div>
        <div class="scene-legend">
          <span><i class="lg normal"></i> 正常</span>
          <span><i class="lg warning"></i> 告警</span>
          <span><i class="lg device"></i> 水田子区域</span>
        </div>
      </main>

      <!-- 右侧：场景对象详情 -->
      <aside class="panel side-panel detail-sidebar" :class="{ 'plot-detail-active': selectedObj?.type === 'plot' }">
        <!-- P2: 实时告警 → 右侧悬浮气泡列表（P5: 全动态） -->
        <div v-if="selectedObj?.type !== 'plot'" class="alarm-bubble-list" :class="alarmStatusClass">
          <div class="abl-header">
            <span class="abl-pulse"></span>
            <span class="abl-title">
              {{ alarmStatus === 'healthy' ? '全图状态良好' : alarmStatus === 'danger' ? '严重告警' : '实时告警' }}
            </span>
            <span class="abl-count num">{{ alerts.length }}</span>
          </div>
          <ul class="abl-body">
            <li
              v-for="a in alerts"
              :key="a.id"
              class="abl-item"
              :class="['level-' + a.level, { 'is-aggregate': a.plotIds && a.plotIds.length > 1 }]"
              role="button"
              tabindex="0"
              @click="onAlertClick(a)"
              @keydown.enter.prevent="onAlertClick(a)"
              :title="a.plotIds && a.plotIds.length > 1 ? '点击高亮全部异常地块' : '点击定位到问题地块'"
            >
              <span class="abl-dot"></span>
              <span class="abl-text">{{ a.text }}</span>
              <span v-if="a.plotIds && a.plotIds.length > 1" class="abl-tag">高亮</span>
              <span class="abl-time num">{{ a.time }}</span>
            </li>
            <!-- P5: 全部正常时显示空状态 -->
            <li v-if="alerts.length === 0" class="abl-item abl-all-clear">
              <span class="abl-dot"></span>
              <span class="abl-text">全图状态良好</span>
              <span class="abl-time">✓</span>
            </li>
          </ul>
        </div>
        <div class="detail-heading">
          <div>
            <span class="eyebrow">{{ selectedObj ? "SELECTED ASSET" : "FIELD MONITORING" }}</span>
            <h2 class="panel-title">{{ selectedObj ? selectedObj.name : "田块墒情" }}</h2>
          </div>
          <button
            v-if="selectedObj"
            class="detail-clear"
            type="button"
            aria-label="清除当前选择"
            @click="clearSelection"
          >
            <span class="detail-clear-icon" aria-hidden="true">×</span>
            <span>清除选择</span>
          </button>
        </div>
        <PlotCloseup
          v-if="selectedObj?.type === 'plot' && selectedPlotParams"
          :plot-id="selectedObj.id"
          :plot-name="selectedObj.name"
          :params="selectedPlotParams"
          :stage="selectedPlotStage"
          :stage-label="STAGE_LABELS[selectedPlotStage] || PLOT_GROWTH_STAGE_LABELS[selectedPlotStage]"
          :progress="selectedPlotProgress"
          :warning-count="selectedPlotWarnings.length"
        />
        <template v-if="selectedObj">
          <div class="selected-object-status">
            <span
              class="soil-dot"
              :class="'status-dot-' + (selectedObj.type === 'component' ? (selectedComponent?.enabled ? 'normal' : 'warning') : selectedObj.status)"
            ></span>
            <span>{{ selectedObj.type === "plot" ? "水田子区域" : selectedObj.type === "component" ? "已挂载组件" : selectedObj.type === "field" ? "水稻田块" : "场景设备" }}</span>
            <span
              class="tag"
              :class="statusClass(selectedObj.type === 'component' ? (selectedComponent?.enabled ? 'normal' : 'warning') : selectedObj.status)"
            >
              {{ selectedObj.type === "component" ? (selectedComponent?.enabled ? "已启用" : "已停用") : statusText(selectedObj.status) }}
            </span>
          </div>
          <p class="obj-desc">{{ selectedObj.desc }}</p>
          <section v-if="selectedObj.type === 'component' && selectedComponent" class="component-detail component-inspector-card">
            <!-- 头部：大图标 + 名称 + 位置 -->
            <div class="cic-head">
              <div class="cic-icon" :class="selectedComponent.type">
                <!-- 与工具栏一致的 SVG 图标，略放大 -->
                <svg v-if="selectedComponent.type === COMPONENT_TYPES.IRRIGATION" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
                  <path d="M12 2.5c0 0-7.5 8.5-7.5 13.5A7.5 7.5 0 0 0 19.5 16C19.5 11 12 2.5 12 2.5z" />
                </svg>
                <svg v-else-if="selectedComponent.type === COMPONENT_TYPES.IRRIGATION_STATION" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M5 9.5h7v10H5z" />
                  <path d="M7 7.5h3v2H7zM15.5 6v13" />
                  <path d="M13.5 19h4M12 12h8M17.5 11.5c-1.3 1-2 2-2 3a2 2 0 0 0 4 0c0-1-.7-2-2-3z" />
                </svg>
                <svg v-else-if="selectedComponent.type === COMPONENT_TYPES.HUMIDIFIER || selectedComponent.type === COMPONENT_TYPES.HUMIDIFIER_STATION" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M7 18h10a3 3 0 0 0 0-6H7a3 3 0 0 0 0 6z" />
                  <path d="M8 9c0-1.5 1.8-2.7 4-2.7s4 1.2 4 2.7" />
                  <path d="M9.5 5.5c0-1 1.1-1.8 2.5-1.8s2.5.8 2.5 1.8" />
                </svg>
                <svg v-else-if="selectedComponent.type === COMPONENT_TYPES.DEHUMIDIFIER || selectedComponent.type === COMPONENT_TYPES.DEHUMIDIFIER_STATION" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="11" r="4" />
                  <path d="M12 7v8M8 11h8M9.2 8.2l5.6 5.6M14.8 8.2l-5.6 5.6" />
                  <path d="M5 19h14" />
                </svg>
                <svg v-else-if="selectedComponent.type === COMPONENT_TYPES.GROW_LIGHT || selectedComponent.type === COMPONENT_TYPES.GROW_LIGHT_STATION" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M8 4h8l1.5 5H6.5L8 4z" />
                  <path d="M9 9l-1 11M15 9l1 11M8 20h8" />
                  <path d="M3 7l2 1M21 7l-2 1M5 3l1.5 2M19 3l-1.5 2" />
                </svg>
                <svg v-else-if="selectedComponent.type === COMPONENT_TYPES.VENTILATION" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
                  <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" />
                  <path d="M12 3c3 3 3 6 0 9c-3 3-6 3-9 0" />
                </svg>
                <svg v-else-if="selectedComponent.type === COMPONENT_TYPES.CO2_SUPPLY" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
                  <path d="M7 18a4 4 0 0 1 0-8a5 5 0 0 1 9.7-1A3.5 3.5 0 0 1 17 18z" />
                </svg>
                <svg v-else-if="selectedComponent.type === COMPONENT_TYPES.CAMERA" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
                  <rect x="3" y="7" width="13" height="10" rx="2" />
                  <path d="M16 10l5-3v10l-5-3z" />
                  <circle cx="9" cy="12" r="2" />
                </svg>
                <!-- P4: 杀虫灯 SVG — 灯罩 + 发光光晕 -->
                <svg v-else-if="selectedComponent.type === COMPONENT_TYPES.PEST_LAMP" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
                  <path d="M12 3v2M8 5h8l1 2H7z" stroke-linejoin="round" />
                  <rect x="7" y="8" width="10" height="4" rx="1" />
                  <path d="M12 12v6M10 18v2M14 18v2" stroke-linecap="round" />
                </svg>
                <!-- P4: 遮阳网 SVG — 伞面 + 竖杆 -->
                <svg v-else-if="selectedComponent.type === COMPONENT_TYPES.SUNSHADE" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
                  <path d="M4 12c2-4 5-6 8-6s6 2 8 6" stroke-linecap="round" />
                  <path d="M4 12h16" />
                  <path d="M12 6v12" stroke-linecap="round" />
                  <path d="M12 18l-2 4M12 18l2 4" stroke-linecap="round" />
                </svg>
                <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
                  <rect x="4" y="4" width="16" height="16" rx="2" />
                </svg>
              </div>
              <div class="cic-meta">
                <div class="cic-name">{{ componentLabel(selectedComponent) }}</div>
                <div class="cic-location">
                  位置 <strong>{{ selectedComponent.plotId === GLOBAL_PLOT_ID ? '全局 / 大田外' : selectedComponent.plotId }}</strong>
                </div>
                <div v-if="selectedComponent.placement" class="cic-location">
                  落点 <strong class="num">X {{ selectedComponent.placement.x.toFixed(1) }} · Z {{ selectedComponent.placement.z.toFixed(1) }}</strong>
                </div>
                <div v-if="selectedComponentCatalog" class="cic-control-mode">
                  主控参数 · <strong>{{ selectedComponentCatalog.primaryMetric }}</strong>
                </div>
                <div v-if="componentAutoTargetText(selectedComponent)" class="cic-control-mode">
                  自动目标 · <strong>{{ componentAutoTargetText(selectedComponent) }}</strong>
                </div>
                <div class="cic-control-mode">{{ componentControlMode(selectedComponent) }}</div>
              </div>
              <!-- 发光 Toggle 开关 -->
              <button
                class="cic-toggle"
                :class="{ on: selectedComponent.enabled }"
                type="button"
                :title="selectedComponent.enabled ? '停用组件' : '启用组件'"
                @click="toggleComponent(selectedComponent)"
              >
                <span class="cic-toggle-track">
                  <span class="cic-toggle-thumb"></span>
                </span>
                <span class="cic-toggle-label">{{ selectedComponent.enabled ? 'ON' : 'OFF' }}</span>
              </button>
            </div>

            <!-- 控制区：Camera/VR 专属按钮 -->
            <div v-if="selectedComponent.type === COMPONENT_TYPES.CAMERA" class="component-camera-view">
              <span>{{ inspectingCameraId === selectedComponent.id ? "正在显示巡检视角" : "巡检视角未开启" }}</span>
              <button class="obj-btn" type="button" :disabled="!selectedComponent.enabled" @click="toggleInspectionView(selectedComponent)">
                {{ inspectingCameraId === selectedComponent.id ? "退出巡检视角" : "切换巡检视角" }}
              </button>
            </div>
            <!-- 影响区：组件对参数的影响描述 -->
            <div class="cic-effects">
              <div class="cic-effects-head">
                <span>对参数的影响</span>
                <span class="tag" :class="selectedComponent.enabled ? 'normal' : 'warning'">
                  {{ selectedComponent.enabled ? '生效中' : '已停用' }}
                </span>
              </div>
              <ul class="cic-effect-list">
                <li v-for="(e, i) in componentEffectList(selectedComponent)" :key="i" class="cic-effect-item">
                  <span class="cic-effect-dot" :class="e.direction"></span>
                  <span class="cic-effect-label">{{ e.label }}</span>
                  <span class="cic-effect-val">{{ e.value }}</span>
                </li>
                <li v-if="!componentEffectList(selectedComponent).length" class="cic-effect-empty">
                  {{ selectedComponent.enabled ? '该组件对演示参数无直接可量化影响' : '组件已停用，无影响' }}
                </li>
              </ul>
            </div>

            <!-- 底部：移除按钮 -->
            <div class="cic-footer">
              <button class="obj-btn component-remove-btn" type="button" @click="removeComponent(selectedComponent)">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                </svg>
                移除该组件
              </button>
            </div>
          </section>
          <div class="obj-metrics" :class="{ 'plot-metrics-grid': selectedObj.type === 'plot' }">
            <div
              v-for="m in selectedObjMetrics"
              :key="m.label"
              class="obj-metric"
              :class="{
                'is-wide': m.label === '生长速率',
                'is-warning': m.tone === 'warning',
                'is-danger': m.tone === 'danger',
              }"
            >
              <span class="obj-metric-label">{{ m.label }}</span>
              <span class="obj-metric-value num">{{ m.value }}<i>{{ m.unit }}</i></span>
              <span v-if="m.reason" class="obj-metric-reason">{{ m.reason }}</span>
              <span v-if="m.advice && m.tone !== 'normal'" class="obj-metric-advice">{{ m.advice }}</span>
            </div>
          </div>
          <template v-if="selectedObj.type === 'plot'">
            <section class="plot-warning-panel">
              <div class="plot-section-heading">
                <span>预警列表</span>
                <span :class="selectedPlotWarnings.length ? 'warning-count' : 'normal-count'">
                  {{ selectedPlotWarnings.length ? `${selectedPlotWarnings.length} 项` : "正常" }}
                </span>
              </div>
              <ul v-if="selectedPlotWarnings.length" class="plot-warning-list">
                <li v-for="warning in selectedPlotWarnings" :key="warning.label">
                  <span class="plot-warning-dot" :class="'is-' + warning.level"></span>
                  <span>{{ warning.message }}</span>
                </li>
              </ul>
              <p v-else class="plot-empty-state">当前参数均在演示阈值范围内</p>
            </section>
            <section class="plot-components-panel">
              <div class="plot-section-heading">
                <span>已挂载组件</span>
                <span class="normal-count">{{ selectedPlotComponents.length }} 个</span>
              </div>
              <p v-if="!selectedPlotComponents.length" class="plot-empty-state">暂无已挂载组件</p>
              <div v-else class="plot-component-list">
                <div v-for="component in selectedPlotComponents" :key="component.id" class="plot-component-row">
                  <button class="plot-component-name" type="button" @click="onComponentSelect(component)">
                    <span class="component-state-dot" :class="{ disabled: !component.enabled }"></span>
                    {{ COMPONENT_TYPE_LABELS[component.type] }}
                  </button>
                  <button class="component-row-action" type="button" @click="toggleComponent(component)">
                    {{ component.enabled ? "停用" : "启用" }}
                  </button>
                  <button class="component-row-action remove" type="button" @click="removeComponent(component)">
                    移除
                  </button>
                </div>
              </div>
            </section>
          </template>
          <p v-if="selectedObj.type === 'field'" class="regional-soil-note">墒情为区域演示值，切换产区后同步变化</p>
        </template>
        <template v-else>
        <div class="soil-summary">
          <span class="soil-dot"></span>
          <span>{{ soilProfile.plot }} · 区域演示墒情</span>
        </div>
        <!-- P3 Part 2+3: 2x2 环形仪表盘（水位、湿度、pH、温度） -->
        <div class="gauge-grid">
          <!-- 地块选中：用 selectedPlotParams；否则用 defaultPlotMetrics + soilMetrics -->
          <GaugeCard
            label="水位"
            :value="(selectedPlotParams || defaultPlotMetrics).waterLevelCm"
            :max="15"
            unit="cm"
            :safe-range="waterSafeRange"
            :tone="globalWaterStatus.tone"
            :hint="globalWaterStatus.tone === 'normal' ? '' : `${globalWaterStatus.reason}；${globalWaterStatus.advice}`"
            :size="72"
          />
          <GaugeCard
            label="土壤湿度"
            :value="(selectedPlotParams || defaultPlotMetrics).moisture ?? soilMetrics[1].value"
            :max="100"
            unit="%"
            :safe-range="[55, 90]"
            :tone="globalMoistureStatus.tone"
            :hint="globalMoistureStatus.tone === 'normal' ? '' : globalMoistureStatus.reason"
            :size="72"
          />
          <GaugeCard
            label="pH 值"
            :value="(selectedPlotParams || defaultPlotMetrics).ph ?? soilMetrics[0].value"
            :max="14"
            :safe-range="[5.5, 7.0]"
            :tone="globalPhStatus.tone"
            :hint="globalPhStatus.tone === 'normal' ? '' : globalPhStatus.reason"
            :size="72"
          />
          <GaugeCard
            label="土壤温度"
            :value="(selectedPlotParams || defaultPlotMetrics).stemp ?? soilMetrics[2].value"
            :max="50"
            unit="°C"
            :safe-range="globalTemperatureRange"
            :tone="globalTemperatureStatus.tone"
            :hint="globalTemperatureStatus.tone === 'normal' ? '' : `${globalTemperatureStatus.reason}；${globalTemperatureStatus.advice}`"
            :size="72"
          />
        </div>

        <!-- 底部：光照 + CO2 横向小卡片 -->
        <div class="env-row">
          <div class="env-card light" :class="'is-' + globalLightStatus.tone">
            <div class="env-head">
              <span class="env-icon">☀</span>
              <span class="env-label">光照强度</span>
            </div>
            <div class="env-val-row">
              <TransitionNum :value="(selectedPlotParams || defaultPlotMetrics).lightLux" :decimals="0" class="num" />
              <span class="env-unit">lux</span>
            </div>
            <div class="env-bar">
              <span class="env-bar-fill" :style="{ width: Math.min(100, ((selectedPlotParams || defaultPlotMetrics).lightLux / 30000) * 100) + '%' }"></span>
            </div>
            <p v-if="globalLightStatus.tone !== 'normal'" class="env-hint">{{ globalLightStatus.reason }}；{{ globalLightStatus.advice }}</p>
          </div>
          <div class="env-card co2" :class="'is-' + globalCo2Status.tone">
            <div class="env-head">
              <span class="env-icon">🌫</span>
              <span class="env-label">CO₂ 浓度</span>
            </div>
            <div class="env-val-row">
              <TransitionNum :value="(selectedPlotParams || defaultPlotMetrics).co2Ppm" :decimals="0" class="num" />
              <span class="env-unit">ppm</span>
            </div>
            <div class="env-bar">
              <span class="env-bar-fill" :style="{ width: Math.min(100, (((selectedPlotParams || defaultPlotMetrics).co2Ppm - 300) / 700) * 100) + '%' }"></span>
            </div>
            <p v-if="globalCo2Status.tone !== 'normal'" class="env-hint">{{ globalCo2Status.reason }}；{{ globalCo2Status.advice }}</p>
          </div>
        </div>
        </template>
      </aside>
    </div>

    <GrowthTimeline
      embedded
      :day="timelineDay"
      :total-days="DEMO_TOTAL_DAYS"
      :stage-label="timelineStageLabel"
      :playing="timelinePlaying"
      :speed="timelineSpeed"
      :days-per-second="TIMELINE_DAYS_PER_SECOND"
      @toggle-play="toggleTimelinePlay"
      @update:speed="timelineSpeed = $event"
      @seek="handleTimelineSeek"
      @tick="handleTimelineTick"
      @end="handleTimelineEnd"
    />

    <!-- P3: 秋收结算报告 -->
    <Transition name="report-fade">
      <div v-if="reportOpen" class="harvest-overlay" @click.self="closeHarvestReport">
        <section
          class="harvest-report"
          role="dialog"
          aria-modal="true"
          aria-labelledby="harvest-report-title"
        >
          <header class="hr-head">
            <div>
              <span class="hr-eyebrow">SEASON {{ seasonCount }} · HARVEST REPORT</span>
              <h2 id="harvest-report-title" class="hr-title">秋收结算报告</h2>
            </div>
            <button class="hr-close" type="button" aria-label="关闭结算报告" @click="closeHarvestReport">×</button>
          </header>

          <div class="hr-hero">
            <div class="hr-yield">
              <span class="hr-yield-num num">{{ estimatedYieldKg }}</span>
              <span class="hr-yield-unit">kg / 亩</span>
              <span class="hr-yield-label">最终预估亩产</span>
            </div>
            <div class="hr-metrics">
              <div class="hr-metric">
                <span class="hr-metric-label">平均生长达标率</span>
                <span class="hr-metric-value num">{{ growthAchievePct }}%</span>
              </div>
              <div class="hr-metric">
                <span class="hr-metric-label">平均健康值</span>
                <span class="hr-metric-value num">{{ Math.round(averageHealthPct) }}%</span>
              </div>
              <div class="hr-metric">
                <span class="hr-metric-label">受阻地块占比</span>
                <span class="hr-metric-value num">{{ Math.round(stressRatio * 100) }}%</span>
              </div>
              <div class="hr-metric">
                <span class="hr-metric-label">平均生长速率</span>
                <span class="hr-metric-value num">{{ Math.round(averageGrowthRatePct) }}%</span>
              </div>
            </div>
          </div>

          <p class="hr-note">全周期 140 天 · Day 140 · 成熟期 · 生长进度、生长速率、健康值与受阻情况已计入产量</p>

          <div class="hr-actions">
            <template v-if="!harvested">
              <button
                class="hr-btn hr-btn-primary"
                type="button"
                :disabled="harvesting"
                @click="startHarvest"
              >{{ harvesting ? "收割中…" : "一键收割" }}</button>
              <button class="hr-btn" type="button" @click="closeHarvestReport">稍后处理</button>
            </template>
            <template v-else>
              <span class="hr-done">✓ 已完成收割，全田变为稻茬</span>
              <button class="hr-btn hr-btn-primary" type="button" @click="startNextSeason">开始下一季</button>
              <button class="hr-btn" type="button" @click="closeHarvestReport">留在本季</button>
            </template>
          </div>
        </section>
      </div>
    </Transition>

    <div class="component-toolbar" role="toolbar" aria-label="组件放置工具">
      <div class="toolbar-group toolbar-group-title">
        <span class="tool-core-dot"></span>
        <span class="toolbar-title">组件工具</span>
        <div class="toolbar-scope-switch" role="group" aria-label="组件作用域">
          <button
            type="button"
            :class="{ active: componentScope === COMPONENT_SCOPES.PLOT }"
            @click="setComponentScope(COMPONENT_SCOPES.PLOT)"
          >田块设备</button>
          <button
            type="button"
            :class="{ active: componentScope === COMPONENT_SCOPES.GLOBAL }"
            @click="setComponentScope(COMPONENT_SCOPES.GLOBAL)"
          >全局设备</button>
        </div>
      </div>

      <div class="toolbar-categories">
        <div v-for="group in activeToolGroups" :key="group.category" class="tool-category">
          <span class="tool-category-label">{{ group.label }}</span>
          <div class="tool-category-buttons">
            <button
              v-for="tool in group.tools"
              :key="`${tool.scope}:${tool.type}`"
              class="tool-pill"
              :class="{ active: placementType === tool.type }"
              type="button"
              @click="togglePlacement(tool.type)"
            >
          <svg class="tool-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <!-- 灌溉：水滴 -->
            <template v-if="tool.type === 'irrigation'">
              <path d="M12 2.5c0 0-7.5 8.5-7.5 13.5A7.5 7.5 0 0 0 19.5 16C19.5 11 12 2.5 12 2.5z" />
              <path d="M9 14c0 1.5 1.2 2.5 3 2.5" />
            </template>
            <!-- 全局灌溉站：储水罐 + 供水管 + 水流 -->
            <template v-else-if="tool.type === 'irrigationStation'">
              <path d="M5 9.5h7v10H5z" />
              <path d="M7 7.5h3v2H7zM15.5 6v13" />
              <path d="M13.5 19h4M12 12h8M17.5 11.5c-1.3 1-2 2-2 3a2 2 0 0 0 4 0c0-1-.7-2-2-3z" />
            </template>
            <!-- 排水：漏斗 + 向下水流 -->
            <template v-else-if="tool.type === 'drainage'">
              <path d="M4 4h16l-6 7v6l-2 4v-10z" />
              <path d="M8.5 19.5c0 1.2 1.1 2 2.5 2s2.5-.8 2.5-2" />
            </template>
            <!-- 增湿：雾化水滴 -->
            <template v-else-if="tool.type === 'humidifier' || tool.type === 'humidifierStation'">
              <path d="M7 18h10a3 3 0 0 0 0-6H7a3 3 0 0 0 0 6z" />
              <path d="M8 9c0-1.5 1.8-2.7 4-2.7s4 1.2 4 2.7" />
              <path d="M9.5 5.5c0-1 1.1-1.8 2.5-1.8s2.5.8 2.5 1.8" />
              <path d="M6 21c1.2-.8 2.4-.8 3.6 0s2.4.8 3.6 0 2.4-.8 3.6 0" />
            </template>
            <template v-else-if="tool.type === 'dehumidifier' || tool.type === 'dehumidifierStation'">
              <circle cx="12" cy="11" r="4" />
              <path d="M12 7v8M8 11h8M9.2 8.2l5.6 5.6M14.8 8.2l-5.6 5.6" />
              <path d="M5 19h14" />
            </template>
            <template v-else-if="tool.type === 'growLight' || tool.type === 'growLightStation'">
              <path d="M8 4h8l1.5 5H6.5L8 4z" />
              <path d="M9 9l-1 11M15 9l1 11M8 20h8" />
              <path d="M3 7l2 1M21 7l-2 1M5 3l1.5 2M19 3l-1.5 2" />
            </template>
            <!-- 通风：螺旋风 -->
            <template v-else-if="tool.type === 'ventilation'">
              <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" />
              <path d="M12 3c3 3 3 6 0 9c-3 3-6 3-9 0" />
              <path d="M12 12c1.5 1.5 3 1.5 4.5 0" />
            </template>
            <!-- CO₂ 供给：气泡分子 -->
            <template v-else-if="tool.type === 'co2Supply'">
              <circle cx="8" cy="14" r="3" />
              <circle cx="14" cy="10" r="2.5" />
              <circle cx="16" cy="16" r="2" />
              <path d="M10 10l2-1M14 13l1 2M12 16l1 1" />
            </template>
            <!-- 摄像头：摄像机 -->
            <template v-else-if="tool.type === 'camera'">
              <rect x="3" y="7" width="13" height="10" rx="2" />
              <path d="M16 10l5-3v10l-5-3z" />
              <circle cx="9" cy="12" r="2" />
            </template>
            <!-- 杀虫灯：灯罩+网格光芒 -->
            <template v-else-if="tool.type === 'pestLamp'">
              <path d="M12 3v3" />
              <path d="M6 9h12l-1.5 8H7.5L6 9z" />
              <path d="M9 12l6 0M8 14l8 0" />
              <circle cx="12" cy="13" r="1.2" />
            </template>
            <!-- 遮阳网：波浪网格 -->
            <template v-else-if="tool.type === 'sunshade'">
              <path d="M3 9c2 1.5 4 1.5 6 0s4-1.5 6 0s4 1.5 6 0" />
              <path d="M3 14c2 1.5 4 1.5 6 0s4-1.5 6 0s4 1.5 6 0" />
              <path d="M3 19c2 1.5 4 1.5 6 0s4-1.5 6 0s4 1.5 6 0" />
              <path d="M12 7v14" />
            </template>
            <!-- 智能增温器：火苗 -->
            <template v-else-if="tool.type === 'heater'">
              <path d="M12 3s-4 4.5-4 8.5a4 4 0 0 0 8 0C16 7.5 12 3 12 3z" />
              <path d="M12 9c-1 1-1.5 2-1.5 3a1.5 1.5 0 0 0 3 0C13.5 11 13 10 12 9z" />
            </template>
            <!-- 排涝泵站：泵房 + 出水口 + 排渠水波 -->
            <template v-else-if="tool.type === 'drainageStation'">
              <path d="M4.5 10L12 5.5 19.5 10v8.5h-15V10z" />
              <path d="M9.5 18.5v-4.5h5v4.5" />
              <path d="M19.5 8.5h2v4h-2" />
              <path d="M2 21c1.5-1 3-1 4.5 0s3 1 4.5 0 3-1 4.5 0 3 1 4.5 0" />
            </template>
          </svg>
              <span class="tool-label">{{ tool.label }}</span>
            </button>
          </div>
        </div>
      </div>

      <div class="toolbar-group toolbar-group-actions">
        <span v-if="placementType" class="placement-hint">
          按 <kbd>Esc</kbd> 取消放置
        </span>
        <button
          v-if="placementType"
          class="tool-pill tool-pill-cancel"
          type="button"
          @click="cancelPlacement"
        >✕ 取消</button>
        <button class="tool-pill tool-pill-inspect" type="button" @click="doInspect">
          <svg class="tool-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
          <span class="tool-label">一键巡检</span>
        </button>
        <button
          class="tool-pill tool-pill-dispatch"
          type="button"
          title="暂停时手动执行一轮环境控制"
          @click="dispatchNow"
        >
          <svg class="tool-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 7h11M11 3l4 4-4 4M20 17H9M13 13l-4 4 4 4" />
          </svg>
          <span class="tool-label">执行一轮</span>
        </button>
      </div>
    </div>

    <!-- Toast：放置模式激活时顶部弹出 -->
    <Transition name="toast-fade">
      <div v-if="placementType" class="placement-toast">
        <span class="toast-pulse"></span>
        已进入 <strong>{{ COMPONENT_TYPE_LABELS[placementType] }}</strong> 放置模式
        · {{ placementInstruction }} · 按 <kbd>Esc</kbd> 取消
      </div>
    </Transition>

    <!-- P2: 整块替换底部三个面板 → 右侧 Drawer + 遮罩 -->
    <Transition name="drawer-fade">
      <div v-if="weatherDrawerOpen" class="drawer-backdrop" @click="weatherDrawerOpen = false"></div>
    </Transition>
    <Transition name="drawer-slide">
      <aside v-if="weatherDrawerOpen" class="drawer-panel weather-drawer" role="dialog" aria-label="天气设置">
        <div class="drawer-header">
          <div class="drawer-title-group">
            <span class="drawer-dot"></span>
            <h2 class="panel-title">天气设置 · {{ selectedRegion.short }}</h2>
          </div>
          <button class="drawer-close" type="button" aria-label="关闭天气设置" @click="weatherDrawerOpen = false">
            ✕
          </button>
        </div>

        <div class="drawer-body">
          <!-- 天气模式切换 -->
          <div class="drawer-section">
            <div class="weather-mode-switch">
              <button
                class="weather-mode-btn"
                :class="{ active: weatherMode === 'actual' }"
                @click="setWeatherMode('actual')"
              >实际天气</button>
              <button
                class="weather-mode-btn"
                :class="{ active: weatherMode === 'simulation' }"
                @click="setWeatherMode('simulation')"
              >模拟天气</button>
            </div>
          </div>

          <!-- 实际天气：逐小时预报 -->
          <div v-if="weatherMode === 'actual'" class="drawer-section">
            <h3 class="drawer-subtitle">逐小时预报</h3>
            <div v-if="forecastItems.length" class="forecast-list">
              <div class="forecast-items">
                <div v-for="item in forecastItems" :key="item.time" class="forecast-item">
                  <span class="forecast-time num">{{ item.time }}</span>
                  <span class="forecast-icon">{{ item.emoji }}</span>
                  <span class="forecast-label">{{ item.label }}</span>
                  <span class="forecast-temp num">{{ item.temperature }}°</span>
                </div>
              </div>
            </div>
            <div v-else class="forecast-empty">{{ forecastMessage }}</div>
          </div>

          <!-- 模拟天气：预设 + 滑块 -->
          <div v-else class="drawer-section">
            <h3 class="drawer-subtitle">天气预设</h3>
            <div class="weather-btns">
              <button
                v-for="w in weathers"
                :key="w.key"
                class="weather-btn"
                :class="{ active: weather === w.key }"
                @click="setWeather(w.key)"
              >{{ w.label }}</button>
              <button v-if="weather !== 'custom'" class="weather-btn" @click="enterCustomMode">⚙ 自定义滑块</button>
            </div>

            <div class="weather-sliders custom-weather-panel" v-if="weather === 'custom'">
              <div class="custom-weather-head">
                <div>
                  <h4 class="drawer-subtitle-sm">自定义环境</h4>
                  <span class="custom-weather-stage">{{ timelineStageLabel }}</span>
                </div>
                <button class="weather-reset-btn" type="button" @click="resetCustomWeatherToOptimal">
                  恢复最优
                </button>
              </div>

              <div class="weather-param-group">
                <span class="weather-group-title">大气环境</span>
                <div class="weather-param-card">
                  <div class="weather-param-head">
                    <label>温度</label>
                    <span class="weather-param-value"><input type="number" min="0" max="45" step="1" v-model.number="sliderTemp" @input="setWeatherSliders" /><i>°C</i></span>
                  </div>
                  <div class="weather-range-wrap">
                    <span class="weather-optimal-marker" :style="{ left: optimalMarkerPct('temperatureC', 0, 45) }"></span>
                    <input type="range" min="0" max="45" step="1" v-model.number="sliderTemp" @input="setWeatherSliders" />
                  </div>
                </div>
                <div class="weather-param-card">
                  <div class="weather-param-head">
                    <label>湿度</label>
                    <span class="weather-param-value"><input type="number" min="0" max="100" step="1" v-model.number="sliderHumidity" @input="setWeatherSliders" /><i>%</i></span>
                  </div>
                  <div class="weather-range-wrap">
                    <span class="weather-optimal-marker" :style="{ left: optimalMarkerPct('humidityPct', 0, 100) }"></span>
                    <input type="range" min="0" max="100" step="1" v-model.number="sliderHumidity" @input="setWeatherSliders" />
                  </div>
                </div>
                <div class="weather-param-card">
                  <div class="weather-param-head">
                    <label>水位</label>
                    <span class="weather-param-value"><input type="number" min="0" max="12" step="0.1" v-model.number="sliderWater" @input="setWeatherSliders" /><i>cm</i></span>
                  </div>
                  <div class="weather-range-wrap">
                    <span class="weather-optimal-marker" :style="{ left: optimalMarkerPct('waterLevelCm', 0, 12) }"></span>
                    <input type="range" min="0" max="12" step="0.1" v-model.number="sliderWater" @input="setWeatherSliders" />
                  </div>
                </div>
                <div class="weather-param-card">
                  <div class="weather-param-head">
                    <label>光照</label>
                    <span class="weather-param-value"><input type="number" min="0" max="30000" step="500" v-model.number="sliderLight" @input="setWeatherSliders" /><i>lux</i></span>
                  </div>
                  <div class="weather-range-wrap">
                    <span class="weather-optimal-marker" :style="{ left: optimalMarkerPct('lightLux', 0, 30000) }"></span>
                    <input type="range" min="0" max="30000" step="500" v-model.number="sliderLight" @input="setWeatherSliders" />
                  </div>
                </div>
              </div>

              <div class="weather-param-group">
                <span class="weather-group-title">风与降雨</span>
                <div class="weather-param-card compact">
                  <div class="weather-param-head">
                    <label>风速</label>
                    <span class="weather-param-value"><input type="number" min="0" max="15" step="0.5" v-model.number="sliderWind" @input="setWeatherSliders" /><i>m/s</i></span>
                  </div>
                  <div class="weather-range-wrap">
                    <span class="weather-optimal-marker" :style="{ left: optimalMarkerPct('wind', 0, 15) }"></span>
                    <input type="range" min="0" max="15" step="0.5" v-model.number="sliderWind" @input="setWeatherSliders" />
                  </div>
                </div>
                <div class="weather-param-card compact">
                  <div class="weather-param-head">
                    <label>降雨</label>
                    <span class="weather-param-value"><input type="number" min="0" max="100" step="1" v-model.number="sliderRain" @input="setWeatherSliders" /><i>mm/h</i></span>
                  </div>
                  <div class="weather-range-wrap">
                    <span class="weather-optimal-marker" :style="{ left: optimalMarkerPct('rain', 0, 100) }"></span>
                    <input type="range" min="0" max="100" step="1" v-model.number="sliderRain" @input="setWeatherSliders" />
                  </div>
                </div>
              </div>
              <button class="weather-btn apply" @click="applyCustomWeather">应用自定义</button>
            </div>
          </div>
        </div>

        <div class="drawer-footer">
          <button class="scan-btn" @click="doInspect">一键巡检</button>
        </div>
      </aside>
    </Transition>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount } from "vue";
import TwinScene from "../components/TwinScene.vue";
import GrowthTimeline from "../components/GrowthTimeline.vue";
import PlotCloseup from "../components/PlotCloseup.vue";
import GaugeCard from "../components/GaugeCard.vue";
import TransitionNum from "../components/TransitionNum.vue";
import {
  fetchActualWeatherSnapshot,
} from "../scene/weatherSource.js";
import {
  ACTUAL_WEATHER_DEFAULTS,
  buildSnapshotFromKey,
  buildSnapshotFromSliders,
  WEATHER_CODE_MAP,
} from "../scene/weatherState.js";
import { getSoilProfile } from "../api.js";
import {
  createInitialPlotStates,
  PLAIN_REGION_CONFIG,
  TERRACE_REGION_CONFIG,
} from "../scene/regionConfigs.ts";
import {
  DEMO_DURATION_SECONDS,
  DEMO_TOTAL_DAYS,
  getStageProfile,
  optimalStageValues,
  STAGE_LABELS,
  stageForProgress,
} from "../scene/riceGrowthModel.js";
import { summarizePlotSettlement } from "../scene/plotSettlement.js";
import {
  environmentMetricStatus,
  metricStatusForRange,
  worstTone,
} from "../scene/environmentStatus.js";
import { FarmComponentManager, GLOBAL_PLOT_ID } from "../scene/farmComponents.js";
import {
  COMPONENT_TYPE_LABELS,
  COMPONENT_TYPES,
  COMPONENT_EFFECTS_BY_TYPE,
  canPlaceFieldWide,
  isGlobalOnlyComponentType,
} from "../scene/farmComponentRates.js";
import {
  COMPONENT_SCOPES,
  componentCatalogEntry,
  componentToolsForScope,
} from "../scene/farmComponentCatalog.js";
import { notify } from "../store.js";

const sceneRef = ref(null);
const sceneView = ref("all");
const sceneViewOptions = Object.freeze([
  { key: "all", label: "全景" },
  { key: "plain", label: "平原田" },
  { key: "terrace", label: "梯田" },
]);

function setSceneView(view) {
  sceneView.value = view;
  sceneRef.value?.focusRegion?.(view);
}
const plotStates = reactive(createInitialPlotStates([
  PLAIN_REGION_CONFIG,
  TERRACE_REGION_CONFIG,
]));
const componentManager = reactive(new FarmComponentManager());
const placementType = ref(null);
const inspectingCameraId = ref(null);
const componentScope = ref(COMPONENT_SCOPES.PLOT);
const activeToolGroups = computed(() => componentToolsForScope(componentScope.value));
const placementInstruction = computed(() => {
  const type = placementType.value;
  if (!type) return "";
  if (isGlobalOnlyComponentType(type)) {
    return "点击大田外围空地放置，效果作用于全部地块";
  }
  if (canPlaceFieldWide(type)) {
    return "点击田块内目标位置放置，也可放在大田外围全局生效";
  }
  return "点击田块内目标位置放置";
});

// —— P3: 生长时间轴（全局日历驱动） ——
const timelineDay = ref(1);
const timelinePlaying = ref(false);
const timelineSpeed = ref(1);
const TIMELINE_DAYS_PER_SECOND = DEMO_TOTAL_DAYS / DEMO_DURATION_SECONDS;

const averageProgress = computed(() => {
  const states = Object.values(plotStates);
  if (!states.length) return 0;
  const total = states.reduce((sum, state) => sum + (state.physiologicalProgress || 0), 0);
  return total / states.length;
});
// 阶段标签只在阶段真正变化时写入响应式状态，避免每 0.1 秒触发整页重渲染
const timelineStageKey = ref(stageForProgress(0));
const timelineStageLabel = ref(STAGE_LABELS[timelineStageKey.value] || "发芽期");
function refreshTimelineStage(rescan = true) {
  const key = stageForProgress(averageProgress.value);
  if (key === timelineStageKey.value) return false;
  timelineStageKey.value = key;
  timelineStageLabel.value = STAGE_LABELS[key] || "发芽期";
  // 阶段变化 = 动态阈值变化，必须立刻重扫告警
  if (rescan) scanPlotAlerts();
  return true;
}

// —— P3: 秋收结算 ——
const harvestAmount = ref(0);
const harvesting = ref(false);
const harvested = ref(false);
const reportOpen = ref(false);
const seasonCount = ref(1);
let harvestRaf = 0;

const settlement = computed(() => summarizePlotSettlement(plotStates));
const averageHealthPct = computed(() => settlement.value.averageHealthPct);
const averageGrowthRatePct = computed(() => settlement.value.averageGrowthRatePct);
const stressRatio = computed(() => settlement.value.blockedPlotRatio);
const estimatedYieldKg = computed(() => settlement.value.estimatedYieldKgPerMu);
const growthAchievePct = computed(() => Math.round(settlement.value.averageProgressPct));

function setTimelineDay(nextDay) {
  timelineDay.value = Math.min(DEMO_TOTAL_DAYS, Math.max(1, nextDay));
}

function handleTimelineSeek(day) {
  setTimelineDay(day);
  const progress = ((timelineDay.value - 1) / (DEMO_TOTAL_DAYS - 1)) * 100;
  Object.values(plotStates).forEach((state) => {
    state.seekGrowth(progress, timelineDay.value);
  });
  // 阶段与阈值同时变化：立即重扫
  refreshTimelineStage(false);
  scanPlotAlerts();
  if (timelineDay.value >= DEMO_TOTAL_DAYS && !harvested.value) {
    openHarvestReport();
  }
}

// 时间轴每 0.1 秒的推进（由 GrowthTimeline 内部 rAF 驱动）
function handleTimelineTick(dtDays) {
  if (!(dtDays > 0)) return;
  Object.values(plotStates).forEach((state) => state.advanceGrowth(dtDays));
  refreshTimelineStage();
}

function handleTimelineEnd() {
  timelinePlaying.value = false;
  setTimelineDay(DEMO_TOTAL_DAYS);
  refreshTimelineStage(false);
  scanPlotAlerts();
  openHarvestReport();
}

function openHarvestReport() {
  timelinePlaying.value = false;
  reportOpen.value = true;
}

// 一键收割：1 秒内把收割进度推到 1，水稻变矮变灰成为稻茬
function startHarvest() {
  if (harvesting.value || harvested.value) return;
  harvesting.value = true;
  const startTs = performance.now();
  const tick = (ts) => {
    const p = Math.min(1, (ts - startTs) / 1000);
    harvestAmount.value = p;
    if (p < 1) {
      harvestRaf = requestAnimationFrame(tick);
    } else {
      harvesting.value = false;
      harvested.value = true;
      notify("收割完成：全田已变为稻茬");
    }
  };
  harvestRaf = requestAnimationFrame(tick);
}

function startNextSeason() {
  seasonCount.value += 1;
  harvested.value = false;
  harvesting.value = false;
  harvestAmount.value = 0;
  reportOpen.value = false;
  handleTimelineSeek(1);
  notify(`第 ${seasonCount.value} 季开始：已重新播种`);
}

function closeHarvestReport() {
  reportOpen.value = false;
}

function toggleTimelinePlay() {
  if (!timelinePlaying.value && timelineDay.value >= DEMO_TOTAL_DAYS) {
    harvested.value = false;
    harvestAmount.value = 0;
    handleTimelineSeek(1);
  }
  timelinePlaying.value = !timelinePlaying.value;
}
const now = ref("");

const regionCatalog = [
  {
    key: "plain",
    short: "洞庭湖",
    name: "洞庭湖平原区",
    climate: "双季稻为主；4–6月降雨集中，汛期需防内涝",
    soil: "湖积水稻土、紫潮泥与潮土，地下水位较高",
    risk: "纹枯、稻瘟、稻曲；洪涝后关注细菌性病害",
    description: "平原垸区、水系密集，重点监测田间水位、排水与高湿环境。",
    terrain: "湖积平原 · 河网与垸田",
    coordinates: { latitude: 29.39, longitude: 113.08 },
  },
  {
    key: "hill",
    short: "湘中",
    name: "湘中丘陵区",
    climate: "双季稻为主；丘陵、岗地与河谷形成局地差异",
    soil: "红壤、紫色土和水稻土，坡耕地较多",
    risk: "稻瘟、纹枯、稻曲；丘陵区留意稻瘟压力",
    description: "海拔约50–300m，坡面汇水和田块排水影响病害风险。",
    terrain: "低丘岗地 · 坡谷相间",
    coordinates: { latitude: 28.228, longitude: 112.939 },
  },
  {
    key: "south",
    short: "湘南",
    name: "湘南丘陵区",
    climate: "双季稻为主；暴雨与高湿天气需重点关注",
    soil: "红壤、紫色土、石灰土及水稻土交错",
    risk: "稻瘟、白叶枯、细菌性条斑与稻曲病",
    description: "海拔约100–500m，丘陵盆地与喀斯特地貌并存，旱涝交替。",
    terrain: "丘陵盆地 · 喀斯特峰丛",
    coordinates: { latitude: 25.85, longitude: 113.12 },
  },
  {
    key: "mountain",
    short: "山区",
    name: "湘西山区",
    climate: "一季中稻为主；海拔高、露雾重，低温阴雨窗口明显",
    soil: "黄壤、黄棕壤、石灰土与紫色土，梯田土壤差异大",
    risk: "稻瘟病高海拔压力突出，兼顾纹枯与稻曲病",
    description: "海拔约500–1200m，梯田碎片化，需关注山地小气候。",
    terrain: "中高山脉 · 河谷梯田",
    coordinates: { latitude: 28.32, longitude: 109.74 },
  },
  {
    key: "east",
    short: "湘东",
    name: "湘东山地过渡带",
    climate: "一季稻与双季稻过渡；山地、丘陵和河谷气候交错",
    soil: "黄壤与红壤为主，河谷和梯田并存",
    risk: "稻瘟、纹枯与稻曲病；按海拔和生育期分区观察",
    description: "海拔约200–800m，适合作为山区与平原之间的过渡示范区。",
    terrain: "山丘过渡 · 河谷平坝",
    coordinates: { latitude: 28.72, longitude: 113.58 },
  },
];

const selectedRegion = ref(regionCatalog[0]);
const REGION_SOIL_PROFILES = {
  plain: {
    plot: "洞庭湖平原示范田",
    metrics: { ph: 6.7, moisture: 74.2, stemp: 19.2, ec: 1.55, n: 13.6, p: 8.5, k: 16.3 },
    layers: [
      { texture: "黏壤土", moisture: 74.2, temp: 19.2, ph: 6.7 },
      { texture: "湖积黏土", moisture: 67.1, temp: 18.1, ph: 6.6 },
      { texture: "粉砂壤土", moisture: 55.8, temp: 16.8, ph: 6.8 },
      { texture: "砂砾质底土", moisture: 37.4, temp: 15.6, ph: 7.0 },
    ],
  },
  hill: {
    plot: "湘中丘陵示范田",
    metrics: { ph: 6.2, moisture: 58.6, stemp: 18.1, ec: 1.28, n: 11.8, p: 7.2, k: 14.7 },
    layers: [
      { texture: "红壤性水稻土", moisture: 58.6, temp: 18.1, ph: 6.2 },
      { texture: "黏壤土", moisture: 53.2, temp: 17.0, ph: 6.0 },
      { texture: "红壤母质层", moisture: 41.5, temp: 15.8, ph: 5.8 },
      { texture: "风化碎屑层", moisture: 29.8, temp: 14.9, ph: 5.9 },
    ],
  },
  south: {
    plot: "湘南丘陵示范田",
    metrics: { ph: 6.0, moisture: 68.4, stemp: 20.4, ec: 1.36, n: 13.1, p: 8.2, k: 15.5 },
    layers: [
      { texture: "红壤性水稻土", moisture: 68.4, temp: 20.4, ph: 6.0 },
      { texture: "红壤黏土", moisture: 61.7, temp: 19.0, ph: 5.8 },
      { texture: "石灰土夹层", moisture: 47.6, temp: 17.3, ph: 6.4 },
      { texture: "风化母质层", moisture: 33.2, temp: 16.0, ph: 6.1 },
    ],
  },
  mountain: {
    plot: "湘西山地梯田示范田",
    metrics: { ph: 5.8, moisture: 64.1, stemp: 16.3, ec: 0.96, n: 10.9, p: 6.8, k: 13.8 },
    layers: [
      { texture: "黄壤性水稻土", moisture: 64.1, temp: 16.3, ph: 5.8 },
      { texture: "黄棕壤黏层", moisture: 58.8, temp: 15.4, ph: 5.6 },
      { texture: "坡积壤土", moisture: 45.3, temp: 14.0, ph: 5.7 },
      { texture: "砾质母质层", moisture: 31.6, temp: 12.8, ph: 5.9 },
    ],
  },
  east: {
    plot: "湘东山地过渡示范田",
    metrics: { ph: 6.1, moisture: 61.7, stemp: 17.6, ec: 1.12, n: 11.5, p: 7.1, k: 14.4 },
    layers: [
      { texture: "黄红壤性水稻土", moisture: 61.7, temp: 17.6, ph: 6.1 },
      { texture: "河谷黏壤土", moisture: 56.4, temp: 16.7, ph: 5.9 },
      { texture: "红壤母质层", moisture: 43.8, temp: 15.2, ph: 5.8 },
      { texture: "坡积碎屑层", moisture: 30.7, temp: 13.9, ph: 6.0 },
    ],
  },
};
const terrainLabel = computed(() => ({
  plain: "平原",
  hill: "丘陵",
  south: "喀斯特丘陵",
  mountain: "山地梯田",
  east: "山地过渡",
}[selectedRegion.value.key] || "区域场景"));
const weatherMode = ref("actual");
// —— P2 新增：Drawer 开关 + 地块结构常量 ——
const weatherDrawerOpen = ref(false);
// P3 布局重构：左侧折叠面板默认收起
const regionAccordionOpen = ref(false);
const PLOT_STRUCTURE = Object.freeze({
  modelCount: 2,
  zonesPerPlot: 25,
  zoneSizeM: "10 × 10",
  totalSizeM: "52.4 × 52.4",
});
const liveWeatherEnabled = computed(() => weatherMode.value === "actual");
const weather = ref("sunny");
const weatherSnapshot = ref(ACTUAL_WEATHER_DEFAULTS);
const simulatedWeather = ref("custom");
const actualWeatherStatus = ref("loading");
const dailyTemperatureRange = ref(null);

const INITIAL_SIM_OPTIMAL = optimalStageValues("germination");
// 自定义模拟天气初始值取发芽期适宜区中位数
const sliderTemp = ref(INITIAL_SIM_OPTIMAL.temperatureC);
const sliderHumidity = ref(INITIAL_SIM_OPTIMAL.humidityPct);
const sliderWater = ref(INITIAL_SIM_OPTIMAL.waterLevelCm);
const sliderLight = ref(INITIAL_SIM_OPTIMAL.lightLux);
const sliderWind = ref(1);
const sliderRain = ref(0);

function optimalMarkerPct(metric, min, max) {
  const optimal = optimalStageValues(timelineStageKey.value);
  const value = metric === "wind" ? 1 : metric === "rain" ? 0 : optimal[metric];
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || max <= min) return "0%";
  return `${Math.max(0, Math.min(100, ((numeric - min) / (max - min)) * 100))}%`;
}

function resetCustomWeatherToOptimal() {
  const optimal = optimalStageValues(timelineStageKey.value);
  sliderTemp.value = optimal.temperatureC;
  sliderHumidity.value = optimal.humidityPct;
  sliderWater.value = optimal.waterLevelCm;
  sliderLight.value = optimal.lightLux;
  sliderWind.value = 1;
  sliderRain.value = 0;
  setWeatherSliders();
}
const weatherModeLabel = computed(() => {
  if (weatherMode.value !== "actual") return "模拟天气";
  if (!dailyTemperatureRange.value) {
    return actualWeatherStatus.value === "loading" ? "今日温度获取中" : "今日温度暂无";
  }
  const freshnessLabel = actualWeatherStatus.value === "cached" ? " · 缓存" : " · 实时";
  return `今日 ${dailyTemperatureRange.value.min}°–${dailyTemperatureRange.value.max}°C${freshnessLabel}`;
});
const weatherFreshnessLabel = computed(() => ({
  live: "实时更新",
  cached: "缓存备用",
  loading: "正在更新",
  unavailable: "网络不可用",
}[actualWeatherStatus.value] || "天气预报"));
const forecastItems = ref([]);
const forecastMessage = ref("正在获取天气预报...");
const WEATHER_CACHE_PREFIX = "agri-twin-weather:v2:";
const WEATHER_CACHE_MAX_AGE_MS = 15 * 60 * 1000;
const weathers = [
  { key: "sunny", label: "晴" },
  { key: "cloudy", label: "多云" },
  { key: "rain", label: "小雨" },
  { key: "wind", label: "大风" },
];
const weatherLabels = { sunny: "晴", cloudy: "多云", rain: "小雨", wind: "大风", custom: "自定义" };
const weatherEmojis = { sunny: "☀️", cloudy: "⛅", rain: "🌧️", wind: "🌬️", custom: "⚙️" };
const weatherLabel = computed(() => {
  if (weatherMode.value === "actual" && actualWeatherStatus.value === "loading" && !dailyTemperatureRange.value) {
    return "天气获取中";
  }
  if (weatherMode.value === "actual" && actualWeatherStatus.value === "unavailable") return "天气暂不可用";
  return weatherLabels[weather.value] || "天气状况未知";
});
const weatherEmoji = computed(() => {
  if (weatherMode.value === "actual" && actualWeatherStatus.value === "unavailable") return "🌐";
  return weatherEmojis[weather.value] || "🌥️";
});

const soilMetrics = ref([
  { key: "ph", label: "pH 值", value: REGION_SOIL_PROFILES.plain.metrics.ph, unit: "", step: 0.1, max: 14, color: "#34d399" },
  { key: "moisture", label: "土壤湿度", value: REGION_SOIL_PROFILES.plain.metrics.moisture, unit: "%", step: 1.0, max: 100, color: "#22d3ee" },
  { key: "stemp", label: "土壤温度", value: REGION_SOIL_PROFILES.plain.metrics.stemp, unit: "°C", step: 0.2, max: 50, color: "#fbbf24" },
  { key: "ec", label: "EC 值", value: REGION_SOIL_PROFILES.plain.metrics.ec, unit: "mS/cm", step: 0.1, max: 5, color: "#2f7bff" },
  { key: "n", label: "氮 (N)", value: REGION_SOIL_PROFILES.plain.metrics.n, unit: "mg/kg", step: 0.5, max: 30, color: "#34d399" },
  { key: "p", label: "磷 (P)", value: REGION_SOIL_PROFILES.plain.metrics.p, unit: "mg/kg", step: 0.4, max: 30, color: "#22d3ee" },
  { key: "k", label: "钾 (K)", value: REGION_SOIL_PROFILES.plain.metrics.k, unit: "mg/kg", step: 0.6, max: 30, color: "#fbbf24" },
]);

const selectedObj = ref(null);
// P3: Inspector 三态状态机（由 selectedObj.type 自动派生）
const inspectionState = computed(() => {
  if (!selectedObj.value) return "default";
  if (selectedObj.value.type === "component") return "component";
  if (selectedObj.value.type === "plot") return "plot";
  return "default";
});
// P3: 土壤含水动画触发 — 天气雨 或 灌溉组件启用
const isSoilWetting = computed(() => {
  if (weather.value === "rain") return true;
  return componentManager.components.some(
    (c) => c.enabled && (
      c.type === COMPONENT_TYPES.IRRIGATION ||
      c.type === COMPONENT_TYPES.IRRIGATION_STATION
    )
  );
});

// P3: 默认面板合成数据（未选中地块时显示全局平均值）
// P5: 重构 — 遍历全部 plotStates 算真·全局平均，绝不能只取第 0 号
const defaultPlotMetrics = computed(() => {
  const states = Object.values(plotStates);
  const count = states.length || 1;
  let water = 0, co2 = 0, humidity = 0, temp = 0, light = 0;
  let hasAny = false;
  for (const s of states) {
    const p = s?.params;
    if (!p) continue;
    hasAny = true;
    water += p.waterLevelCm ?? 0;
    co2 += p.co2Ppm ?? 0;
    humidity += p.humidityPct ?? 0;
    temp += p.temperatureC ?? 0;
    light += p.lightLux ?? 0;
  }
  // 如果 plotStates 还没初始化好（理论上不会），兜底用天气快照
  const snap = weatherSnapshot.value;
  return {
    waterLevelCm: hasAny ? water / count   : 4.5,
    co2Ppm:       hasAny ? co2 / count       : 420,
    humidityPct:  hasAny ? humidity / count  : snap?.humidity ?? 60,
    temperatureC: hasAny ? temp / count      : snap?.temperature ?? 25,
    lightLux:     hasAny ? light / count     : snap?.light ?? 12000,
    // 以下三项用全局平均替代
    moisture:     hasAny ? humidity / count  : snap?.humidity ?? 60,  // 土壤湿度 ≈ 空气湿度简化
    ph:           6.5,                                                // pH 暂不随模拟变
    stemp:        hasAny ? temp / count      : snap?.temperature ?? 25,
  };
});
const globalWaterStatus = computed(() =>
  environmentMetricStatus("waterLevelCm", defaultPlotMetrics.value.waterLevelCm, timelineStageKey.value)
);
const globalCo2Status = computed(() =>
  environmentMetricStatus("co2Ppm", defaultPlotMetrics.value.co2Ppm, timelineStageKey.value)
);
const globalLightStatus = computed(() =>
  environmentMetricStatus("lightLux", defaultPlotMetrics.value.lightLux, timelineStageKey.value)
);
const globalTemperatureStatus = computed(() =>
  environmentMetricStatus("temperatureC", defaultPlotMetrics.value.temperatureC, timelineStageKey.value)
);
const globalTemperatureRange = computed(() =>
  getStageProfile(timelineStageKey.value).ideal.temperatureC
);
const globalMoistureStatus = computed(() =>
  metricStatusForRange(defaultPlotMetrics.value.moisture, [55, 90], [35, 97], {
    stageLabel: "土壤湿度",
    unit: "%",
    digits: 1,
    adviceLow: "开启灌溉装置或全局灌溉站增湿",
    adviceHigh: "开启通风装置或排涝泵站降湿",
  })
);
const globalPhStatus = computed(() =>
  metricStatusForRange(defaultPlotMetrics.value.ph, [5.5, 7], [4.5, 8.5], {
    stageLabel: "土壤 pH",
    digits: 1,
  })
);
const globalEnvironmentTone = computed(() =>
  worstTone(globalCo2Status.value.tone, globalLightStatus.value.tone)
);
const selectedComponent = computed(() => {
  if (selectedObj.value?.type !== "component") return null;
  return componentManager.getById(selectedObj.value.id);
});
const selectedComponentCatalog = computed(() => {
  const component = selectedComponent.value;
  if (!component) return null;
  const scope = component.plotId === GLOBAL_PLOT_ID
    ? COMPONENT_SCOPES.GLOBAL
    : COMPONENT_SCOPES.PLOT;
  return componentCatalogEntry(component.type, scope);
});
const selectedPlotComponents = computed(() => {
  if (selectedObj.value?.type !== "plot") return [];
  return componentManager.listByPlot(selectedObj.value.id);
});
const PLOT_GROWTH_STAGE_LABELS = {
  germination: "发芽期",
  seedling: "幼苗期",
  tillering: "分蘖期",
  jointing: "拔节期",
  heading: "抽穗期",
  filling: "灌浆期",
  maturity: "成熟期",
};
const selectedPlotParams = computed(() => {
  if (selectedObj.value?.type !== "plot") return null;
  return plotStates[selectedObj.value.id]?.params || null;
});
const selectedPlotState = computed(() => {
  if (selectedObj.value?.type !== "plot") return null;
  return plotStates[selectedObj.value.id] || null;
});
const selectedPlotStage = computed(() =>
  selectedPlotState.value?.currentStage || selectedPlotParams.value?.growthStage || "germination"
);
const selectedPlotProgress = computed(() =>
  selectedPlotState.value?.physiologicalProgress ?? 0
);
// P3: 水位安全区间随生长阶段动态收紧/放宽（分蘖 3-5cm → 成熟 0-1cm）
const waterSafeRange = computed(() => {
  const state = selectedObj.value?.type === "plot" ? plotStates[selectedObj.value.id] : null;
  const stageKey = state?.currentStage || timelineStageKey.value;
  const range = getStageProfile(stageKey).ideal.waterLevelCm;
  return [range[0], range[1]];
});
const selectedPlotWarnings = computed(() => {
  const params = selectedPlotParams.value;
  if (!params) return [];
  const warnings = [];
  const stageKey = selectedPlotStage.value;
  const checks = [
    ["waterLevelCm", "水位", params.waterLevelCm, (value) => `${value.toFixed(1)} cm`],
    ["co2Ppm", "CO₂", params.co2Ppm, (value) => `${value.toFixed(0)} ppm`],
    ["temperatureC", "温度", params.temperatureC, (value) => `${value.toFixed(1)} °C`],
    ["humidityPct", "湿度", params.humidityPct, (value) => `${value.toFixed(1)}%`],
    ["lightLux", "光照", params.lightLux, (value) => `${Math.round(value)} lux`],
  ];
  for (const [key, label, value, format] of checks) {
    const status = environmentMetricStatus(key, value, stageKey);
    if (status.tone === "normal") continue;
    warnings.push({
      label: `${key}-${status.direction}`,
      level: status.tone,
      message: `${label}${status.reason}（当前 ${format(value)}），${status.advice}`,
    });
  }
  if (params.healthPct < 60) {
    warnings.push({
      label: "health-low",
      level: "danger",
      message: `健康值低于危险线（当前 ${params.healthPct.toFixed(0)}%），排查持续受阻因素`,
    });
  }
  return warnings;
});
const soilProfileData = ref({});
const DEFAULT_SOIL_LAYERS = [
  { name: "耕作层（表土）", from: 0, to: 30, color: "#6f5537" },
  { name: "黏土层", from: 30, to: 90, color: "#a87b45" },
  { name: "砂土层", from: 90, to: 160, color: "#c3a16b" },
  { name: "砾石层", from: 160, to: 220, color: "#86898b" },
];
const soilProfile = computed(() => {
  const regional = REGION_SOIL_PROFILES[selectedRegion.value.key];
  const layers = soilProfileData.value.layers?.length ? soilProfileData.value.layers : DEFAULT_SOIL_LAYERS;
  return {
    ...soilProfileData.value,
    plot: regional.plot,
    totalDepth: soilProfileData.value.totalDepth || 220,
    layers: layers.map((layer, index) => ({ ...layer, ...regional.layers[index] })),
  };
});

const selectedObjMetrics = computed(() => {
  if (selectedObj.value?.type === "plot" && selectedPlotParams.value) {
    const params = selectedPlotParams.value;
    const plotState = plotStates[selectedObj.value.id];
    const stageKey = plotState?.currentStage || params.growthStage;
    const stageLabel = STAGE_LABELS[plotState?.currentStage] ||
      PLOT_GROWTH_STAGE_LABELS[params.growthStage] || params.growthStage;
    const progress = plotState?.physiologicalProgress ?? 0;
    const ratePct = Math.round(plotState?.growthRatePct ?? 100);
    const reason = plotState?.stressReason;
    const rateTone = plotState?.growthStalled || ratePct < 30
      ? "danger"
      : plotState?.stressed || ratePct < 60
        ? "warning"
        : "normal";
    const rateReason = plotState?.growthStalled
      ? `生长停滞：${reason || "环境不适"}`
      : plotState?.stressed
        ? `受阻：${reason || "环境不适"}`
        : ratePct < 60
          ? "低于生长速率关注阈值 60%"
          : "";
    const waterStatus = environmentMetricStatus("waterLevelCm", params.waterLevelCm, stageKey);
    const co2Status = environmentMetricStatus("co2Ppm", params.co2Ppm, stageKey);
    const temperatureStatus = environmentMetricStatus("temperatureC", params.temperatureC, stageKey);
    const humidityStatus = environmentMetricStatus("humidityPct", params.humidityPct, stageKey);
    const lightStatus = environmentMetricStatus("lightLux", params.lightLux, stageKey);
    const healthStatus = params.healthPct < 60
      ? {
          tone: "danger",
          reason: "低于健康危险线 60%",
          advice: "排查持续受阻因素并优先调节标红环境指标",
        }
      : params.healthPct < 75
        ? {
            tone: "warning",
            reason: "低于健康关注线 75%",
            advice: "检查水位、温度和湿度，避免长期受阻",
          }
        : { tone: "normal", reason: "", advice: "" };
    return [
      {
        label: "水位",
        value: params.waterLevelCm.toFixed(1),
        unit: "cm",
        ...waterStatus,
      },
      {
        label: "CO₂",
        value: params.co2Ppm.toFixed(0),
        unit: "ppm",
        ...co2Status,
      },
      {
        label: "温度",
        value: params.temperatureC.toFixed(1),
        unit: "°C",
        ...temperatureStatus,
      },
      {
        label: "湿度",
        value: params.humidityPct.toFixed(1),
        unit: "%",
        ...humidityStatus,
      },
      {
        label: "光照",
        value: Math.round(params.lightLux).toLocaleString("zh-CN"),
        unit: "lux",
        ...lightStatus,
      },
      { label: "生长阶段", value: stageLabel, unit: "" },
      { label: "生理进度", value: progress.toFixed(1), unit: "%" },
      {
        label: "生长速率",
        value: plotState?.growthStalled ? "0%" : `${ratePct}%`,
        unit: "",
        tone: rateTone,
        reason: rateReason,
        advice: rateTone === "normal"
          ? ""
          : "检查水位、温度、湿度、CO₂与光照，优先处理标红指标",
      },
      {
        label: "健康值",
        value: params.healthPct.toFixed(0),
        unit: "%",
        ...healthStatus,
      },
    ];
  }
  if (!selectedObj.value || selectedObj.value.type !== "field") return selectedObj.value?.metrics || [];
  const regionalMetrics = Object.fromEntries(soilMetrics.value.map((metric) => [metric.key, metric.value]));
  const fieldDeltas = selectedObj.value.id === "field_2"
    ? { moisture: -3.7, stemp: 0.6, ec: -0.14, ph: 0.3 }
    : { moisture: 0, stemp: 0, ec: 0, ph: 0 };
  const metricKeys = {
    "土壤墒情": "moisture",
    "土壤温度": "stemp",
    "电导率 EC": "ec",
    "土壤 pH": "ph",
  };
  return selectedObj.value.metrics.map((metric) => {
    const key = metricKeys[metric.label];
    if (!key) return metric;
    const value = Number(regionalMetrics[key]) + fieldDeltas[key];
    return { ...metric, value: key === "ec" ? value.toFixed(2) : value.toFixed(1) };
  });
});

function statusText(s) {
  return s === "warning" ? "告警" : s === "danger" ? "故障" : "正常";
}

function statusClass(s) {
  return s === "warning" ? "tag-orange" : s === "danger" ? "tag-red" : "tag-green";
}

function onSelect(obj) {
  if (obj?.type === "plot") {
    sceneView.value = String(obj.id).startsWith("Terrace") ? "terrace" : "plain";
  }
  if (placementType.value && obj?.type === "plot") {
    if (componentScope.value === COMPONENT_SCOPES.GLOBAL) {
      notify("当前为全局设备，请点击大田外围空地放置");
      return;
    }
    // P16: 排涝泵站只作用于全图，必须放在大田外围
    if (isGlobalOnlyComponentType(placementType.value)) {
      notify(`${COMPONENT_TYPE_LABELS[placementType.value]}需放置在田外空地（效果作用于全图）`);
      return;
    }
    const point = obj.placementPoint;
    const placement = placementType.value === COMPONENT_TYPES.SUNSHADE
      ? { x: 0, z: 0, rotationY: 0 }
      : point && Number.isFinite(Number(point.x)) && Number.isFinite(Number(point.z))
        ? {
            x: Math.max(-4.2, Math.min(4.2, Number(point.x))),
            z: Math.max(-4.2, Math.min(4.2, Number(point.z))),
            rotationY: Math.atan2(Number(point.x), Number(point.z)),
          }
        : null;
    const result = componentManager.attach(obj.id, placementType.value, placement);
    if (!result.ok) {
      notify(`${COMPONENT_TYPE_LABELS[placementType.value]}已挂载到该子区域，不能重复添加`);
      selectedObj.value = obj;
      return;
    }
    const name = COMPONENT_TYPE_LABELS[result.component.type];
    placementType.value = null;
    selectedObj.value = obj;
    sceneRef.value?.syncComponents();
    notify(`${name}已挂载到${obj.name}`);
    return;
  }
  selectedObj.value = obj;
}

// P7: 放置模式下点击大田外围底板 → 全局设备（plotId = "global"）
function onGroundClick(payload) {
  const type = placementType.value;
  const point = payload?.point;
  if (!type || !point) return;

  if (componentScope.value !== COMPONENT_SCOPES.GLOBAL) {
    notify("田块设备请点击田块内目标位置放置");
    return;
  }

  if (!canPlaceFieldWide(type)) {
    notify(`${COMPONENT_TYPE_LABELS[type]}只能放置在田块中`);
    placementType.value = null;
    return;
  }

  const placement = {
    x: Number(point.x.toFixed(2)),
    z: Number(point.z.toFixed(2)),
    // P10: 全局设备正面朝向全场几何中心 (40, 0)，与巡检初始 lookAt 保持一致
    // 模型正向为 -Z：rotationY = atan2(x - 40, z)
    rotationY: Math.atan2(point.x - 40, point.z),
  };
  const result = componentManager.attach(GLOBAL_PLOT_ID, type, placement);
  if (!result.ok) {
    notify(`${COMPONENT_TYPE_LABELS[type]}已在大田外围布置过，不能重复添加`);
    placementType.value = null;
    return;
  }

  const name = componentLabel(result.component);
  placementType.value = null;
  sceneRef.value?.syncComponents();
  // 放置后直接选中，Inspector 会显示"位置：全局 / 大田外"
  onComponentSelect(result.component);
  notify(`${name}已放置到大田外围（效果作用于全图）`);
}

// P13: 全局增温器 = 农场集中供暖站，田内增温器 = 局部增温器
function componentLabel(component) {
  if (!component) return "";
  const catalogEntry = componentCatalogEntry(
    component.type,
    component.plotId === GLOBAL_PLOT_ID ? COMPONENT_SCOPES.GLOBAL : COMPONENT_SCOPES.PLOT
  );
  if (catalogEntry) return catalogEntry.label;
  if (component.type === COMPONENT_TYPES.HEATER) {
    return component.plotId === GLOBAL_PLOT_ID ? "农场集中供暖站" : "局部增温器";
  }
  return COMPONENT_TYPE_LABELS[component.type];
}

function componentControlMode(component) {
  if (!component) return "";
  switch (component.type) {
    case COMPONENT_TYPES.IRRIGATION:
    case COMPONENT_TYPES.IRRIGATION_STATION:
      return "自动控制 · 向阶段中位水位调节，进入中位死区后待机";
    case COMPONENT_TYPES.DRAINAGE:
    case COMPONENT_TYPES.DRAINAGE_STATION:
      return "自动控制 · 向阶段中位水位调节，进入中位死区后待机";
    case COMPONENT_TYPES.HEATER:
      return "恒温控制 · 向阶段中位温度调节，进入中位死区后待机";
    case COMPONENT_TYPES.VENTILATION:
      return "自动控制 · 温度、湿度或 CO₂ 高于中位时向中位调节";
    case COMPONENT_TYPES.CO2_SUPPLY:
      return "自动控制 · 向阶段中位 CO₂ 调节，进入中位死区后待机";
    case COMPONENT_TYPES.HUMIDIFIER:
    case COMPONENT_TYPES.HUMIDIFIER_STATION:
      return "自动控制 · 向阶段中位湿度调节，进入中位死区后待机";
    case COMPONENT_TYPES.DEHUMIDIFIER:
    case COMPONENT_TYPES.DEHUMIDIFIER_STATION:
      return "自动控制 · 湿度高于中位时除湿，进入中位死区后待机";
    case COMPONENT_TYPES.SUNSHADE:
      return "自动控制 · 光照高于中位时遮阳，进入中位死区后收起";
    case COMPONENT_TYPES.GROW_LIGHT:
    case COMPONENT_TYPES.GROW_LIGHT_STATION:
      return "自动控制 · 光照低于中位时补光，进入中位死区后待机";
    default:
      return "手动控制";
  }
}

function componentAutoTargetText(component) {
  if (!component) return "";
  const stageKey = component.plotId === GLOBAL_PLOT_ID
    ? timelineStageKey.value
    : plotStates[component.plotId]?.currentStage || timelineStageKey.value;
  const ideal = getStageProfile(stageKey).ideal;
  const target = (range) => (range[0] + range[1]) / 2;
  switch (component.type) {
    case COMPONENT_TYPES.IRRIGATION:
    case COMPONENT_TYPES.IRRIGATION_STATION:
    case COMPONENT_TYPES.DRAINAGE:
    case COMPONENT_TYPES.DRAINAGE_STATION:
      return `水位 ${target(ideal.waterLevelCm).toFixed(1)}cm`;
    case COMPONENT_TYPES.HUMIDIFIER:
    case COMPONENT_TYPES.HUMIDIFIER_STATION:
    case COMPONENT_TYPES.DEHUMIDIFIER:
    case COMPONENT_TYPES.DEHUMIDIFIER_STATION:
      return `湿度 ${target(ideal.humidityPct).toFixed(1)}%`;
    case COMPONENT_TYPES.HEATER:
      return `温度 ${target(ideal.temperatureC).toFixed(1)}°C`;
    case COMPONENT_TYPES.VENTILATION:
      return `温湿度与 CO₂ 阶段中位`;
    case COMPONENT_TYPES.CO2_SUPPLY:
      return `CO₂ ${Math.round(target(ideal.co2Ppm))}ppm`;
    case COMPONENT_TYPES.SUNSHADE:
    case COMPONENT_TYPES.GROW_LIGHT:
    case COMPONENT_TYPES.GROW_LIGHT_STATION:
      return `光照 ${Math.round(target(ideal.lightLux))}lux`;
    default:
      return "";
  }
}

function onComponentSelect(component) {
  if (!component) return;
  placementType.value = null;
  const isGlobal = component.plotId === GLOBAL_PLOT_ID;
  const label = componentLabel(component);
  selectedObj.value = {
    id: component.id,
    type: "component",
    name: label,
    status: component.enabled ? "normal" : "warning",
    desc: isGlobal
      ? `大田外围的${label}，效果作用于全图`
      : `${component.plotId} 上的${label}`,
  };
}

function togglePlacement(type) {
  if (inspectingCameraId.value) {
    sceneRef.value?.exitInspectionView();
    inspectingCameraId.value = null;
  }
  placementType.value = placementType.value === type ? null : type;
}

function setComponentScope(scope) {
  if (scope !== COMPONENT_SCOPES.PLOT && scope !== COMPONENT_SCOPES.GLOBAL) return;
  componentScope.value = scope;
  placementType.value = null;
}

function cancelPlacement() {
  placementType.value = null;
}

// P2/P3: Esc 优先级关 Drawer → 取消放置模式 → 清除选中
function handleKeydown(e) {
  if (e.key === "Escape") {
    if (weatherDrawerOpen.value) {
      weatherDrawerOpen.value = false;
      e.stopPropagation();
      return;
    }
    if (placementType.value) {
      placementType.value = null;
      e.stopPropagation();
      return;
    }
    if (selectedObj.value) {
      clearSelection();
      e.stopPropagation();
    }
  }
}

function toggleComponent(component) {
  const nextEnabled = !component.enabled;
  if (!nextEnabled && inspectingCameraId.value === component.id) {
    sceneRef.value?.exitInspectionView();
    inspectingCameraId.value = null;
  }
  const result = componentManager.setEnabled(component.id, nextEnabled);
  if (!result.ok) {
    notify("组件状态更新失败：组件不存在");
    return;
  }
  sceneRef.value?.syncComponents();
}

// P3: 组件对参数影响描述（从 farmComponentRates.js 读取）
function componentEffectList(component) {
  if (!component) return [];
  const effects = COMPONENT_EFFECTS_BY_TYPE[component.type];
  if (!effects) return [];
  const LABELS = {
    waterLevelCmPerSecond:      { label: "水位",   unit: "cm/s",   direction: "+" },
    co2SupplyPpmPerSecond:      { label: "CO₂ 供给", unit: "ppm/s",  direction: "+" },
    co2VentilationRate:         { label: "通风速率", unit: "r/s",    direction: "+" },
    temperatureCPerSecond:      { label: "温度",   unit: "°C/s",   direction: "±" },
    humidityPctPerSecond:       { label: "湿度",   unit: "%/s",    direction: "±" },
    lightLuxDelta:              { label: "光照",   unit: "lux",    direction: "+" },
  };
  const result = [];
  for (const [key, val] of Object.entries(effects)) {
    if (Math.abs(val) < 0.001) continue;
    const meta = LABELS[key] || { label: key, unit: "", direction: "+" };
    result.push({
      label: meta.label,
      value: `${val >= 0 ? '+' : ''}${val.toFixed(2)} ${meta.unit}`,
      direction: val > 0 ? "up" : val < 0 ? "down" : "neutral",
    });
  }
  return result;
}

function removeComponent(component) {
  if (inspectingCameraId.value === component.id) {
    sceneRef.value?.exitInspectionView();
    inspectingCameraId.value = null;
  }
  const result = componentManager.remove(component.id);
  if (!result.ok) {
    notify("移除失败：组件不存在");
    return;
  }
  if (selectedObj.value?.type === "component" && selectedObj.value.id === component.id) {
    selectedObj.value = null;
  }
  sceneRef.value?.syncComponents();
  notify(`${COMPONENT_TYPE_LABELS[component.type]}已移除`);
}

function toggleInspectionView(component) {
  if (inspectingCameraId.value === component.id) {
    sceneRef.value?.exitInspectionView();
    inspectingCameraId.value = null;
    return;
  }
  if (!component.enabled) return;
  if (inspectingCameraId.value) sceneRef.value?.exitInspectionView();
  const entered = sceneRef.value?.enterInspectionView(component.id);
  if (!entered) {
    inspectingCameraId.value = null;
    notify("无法切换巡检视角，请确认摄像头已启用");
    return;
  }
  inspectingCameraId.value = component.id;
  notify("巡检视角：左右拖拽/AD 平移，上下拖拽/WS 俯仰，滚轮/QE 缩放，Esc 退出");
}

function clearSelection() {
  placementType.value = null;
  if (inspectingCameraId.value) {
    sceneRef.value?.exitInspectionView();
    inspectingCameraId.value = null;
  }
  selectedObj.value = null;
  if (sceneRef.value) sceneRef.value.selectObject(null);
}

// P5: 告警数组（由 scanPlotAlerts 动态生成）
const alerts = ref([]);
let alertsTimer = 0;

// P5: 三色状态机 — 根据告警数组算整体状态
const alarmStatus = computed(() => {
  if (!alerts.value.length) return "healthy";
  // 任意一条是 danger → 整体 danger
  const hasDanger = alerts.value.some((a) => a.level === "danger");
  return hasDanger ? "danger" : "warning";
});
const alarmStatusClass = computed(() => `status-${alarmStatus.value}`);

const HEALTH_ALERT_LOW_PCT = 60;

// P7: 告警聚合 —— 同类型问题合并成 1 条主告警，杜绝「告警风暴」刷屏
const ALERT_AGGREGATE_MIN = 3;   // ≥3 个地块同类型异常 → 合并成一条全局告警
const ALERT_LIST_MAX = 6;        // 列表最多展示 6 条，任何情况下都不刷屏

// 每类问题的文案 / 级别 / 取极值方向（聚合时展示"最低/最高"）
const ALERT_ISSUE_DEFS = Object.freeze({
  tempLow:   { label: "温度偏低", extreme: "min", digits: 1, unit: "℃" },
  tempHigh:  { label: "温度偏高", extreme: "max", digits: 1, unit: "℃" },
  waterLow:  { label: "水位偏低", extreme: "min", digits: 1, unit: "cm" },
  waterHigh: { label: "水位偏高", extreme: "max", digits: 1, unit: "cm" },
  waterDrainage: { label: "成熟期需排水晒田", extreme: "max", digits: 1, unit: "cm" },
  healthLow: { label: "健康偏低", extreme: "min", digits: 0, unit: "%" },
  co2Low:    { label: "CO₂ 偏低", extreme: "min", digits: 0, unit: "ppm" },
  co2High:   { label: "CO₂ 偏高", extreme: "max", digits: 0, unit: "ppm" },
  humLow:    { label: "湿度偏低", extreme: "min", digits: 1, unit: "%" },
  humHigh:   { label: "湿度偏高", extreme: "max", digits: 1, unit: "%" },
  lightLow:  { label: "光照不足", extreme: "min", digits: 0, unit: "lux" },
  lightHigh: { label: "光照过强", extreme: "max", digits: 0, unit: "lux" },
});

// 单地块显示名：Plain-R01-C02 → 平原 1行2格
function plotDisplayName(plotId) {
  const m = /^(Plain|Terrace)-R(\d{2})-C(\d{2})$/.exec(String(plotId || ""));
  if (!m) return String(plotId || "");
  return `${m[1] === "Plain" ? "平原" : "梯田"} ${Number(m[2])}行${Number(m[3])}格`;
}

// P7: 扫描全部地块 → 按问题类型分组 → 少量异常列明细，大面积异常合并
let lastAlertKey = "";
function scanPlotAlerts() {
  const groups = new Map();

  const collect = (key, plotId, value, level) => {
    let group = groups.get(key);
    if (!group) {
      group = { key, level: "normal", entries: [] };
      groups.set(key, group);
    }
    group.level = worstTone(group.level, level);
    group.entries.push({ plotId, value, level });
  };

  const stalledPlots = [];

  for (const [plotId, state] of Object.entries(plotStates)) {
    const p = state.params;
    // 动态阈值：只有水位按地块当前阶段的适宜区间判断（发芽 1-3cm、分蘖 3-5cm、成熟 0-1cm…）
    const isMaturity = state.currentStage === "maturity";
    const checks = [
      ["waterLevelCm", "waterLow", "waterHigh", p.waterLevelCm],
      ["co2Ppm", "co2Low", "co2High", p.co2Ppm],
      ["temperatureC", "tempLow", "tempHigh", p.temperatureC],
      ["humidityPct", "humLow", "humHigh", p.humidityPct],
      ["lightLux", "lightLow", "lightHigh", p.lightLux],
    ];
    for (const [metricKey, lowKey, highKey, value] of checks) {
      const status = environmentMetricStatus(metricKey, value, state.currentStage);
      if (status.tone === "normal") continue;
      const key = metricKey === "waterLevelCm" && status.direction === "high" && isMaturity
        ? "waterDrainage"
        : status.direction === "low"
          ? lowKey
          : highKey;
      collect(key, plotId, value, status.tone);
    }
    if (p.healthPct < HEALTH_ALERT_LOW_PCT) {
      collect("healthLow", plotId, p.healthPct, "danger");
    }

    // P4: 生长停滞的农学归因（与参数超标告警并行展示）
    if (state.growthStalled) {
      stalledPlots.push({
        plotId,
        reason: state.stressReason || "环境不适",
        text: state.stressDetail?.text || "环境参数超出适宜区间",
        stage: STAGE_LABELS[state.currentStage] || "当前阶段",
      });
    }
  }

  const newAlerts = [];
  for (const group of groups.values()) {
    const def = ALERT_ISSUE_DEFS[group.key];
    if (!def) continue;
    const count = group.entries.length;

    if (count < ALERT_AGGREGATE_MIN) {
      // 1-2 个地块 → 保留单地块明细，方便精准定位
      for (const entry of group.entries) {
        newAlerts.push({
          id: `${entry.plotId}-${group.key}`,
          plotId: entry.plotId,
          level: entry.level,
          text: `[${plotDisplayName(entry.plotId)}] ${def.label} (${entry.value.toFixed(def.digits)}${def.unit})`,
          time: timeStr(),
        });
      }
      continue;
    }

    // ≥3 个地块 → 只生成 1 条主告警，附带全部地块 id 供高亮
    const values = group.entries.map((entry) => entry.value);
    const extremeValue = def.extreme === "min" ? Math.min(...values) : Math.max(...values);
    const extremeWord = def.extreme === "min" ? "最低" : "最高";
    newAlerts.push({
      id: `AGG-${group.key}`,
      plotId: group.entries[0].plotId,
      plotIds: group.entries.map((entry) => entry.plotId),
      issueLabel: def.label,
      level: group.level,
      text: `[全局预警] ${count} 个地块${def.label} (${extremeWord} ${extremeValue.toFixed(def.digits)}${def.unit})`,
      time: timeStr(),
    });
  }

  // P4: 生长停滞告警 —— 单地块给具体农学原因，大面积按主因聚合
  if (stalledPlots.length) {
    const byReason = new Map();
    for (const item of stalledPlots) {
      const list = byReason.get(item.reason) || [];
      list.push(item);
      byReason.set(item.reason, list);
    }
    let topReason = "环境不适";
    let topGroup = [];
    for (const [reason, list] of byReason) {
      if (list.length > topGroup.length) {
        topReason = reason;
        topGroup = list;
      }
    }
    if (stalledPlots.length === 1) {
      const item = stalledPlots[0];
      newAlerts.push({
        id: `growthStall-${item.plotId}`,
        plotId: item.plotId,
        level: "danger",
        text: `[${plotDisplayName(item.plotId)}] 生长严重受阻：${item.stage}，${item.text}`,
        time: timeStr(),
      });
    } else {
      newAlerts.push({
        id: "AGG-growthStall",
        plotId: topGroup[0].plotId,
        plotIds: stalledPlots.map((item) => item.plotId),
        issueLabel: "生长停滞",
        level: "danger",
        text: `[全局预警] ${stalledPlots.length} 个地块生长停滞：${topReason}导致生长严重受阻`,
        time: timeStr(),
      });
    }
  }

  // 严重优先、影响面大的优先；总数封顶，彻底避免长列表
  newAlerts.sort((a, b) => {
    if (a.level !== b.level) return a.level === "danger" ? -1 : 1;
    return (b.plotIds?.length || 1) - (a.plotIds?.length || 1);
  });
  const trimmed = newAlerts.slice(0, ALERT_LIST_MAX);

  // key 带上数值：温度整体回升时文案会同步刷新，异常消失后该条自动移除
  const key = trimmed.map((a) => `${a.id}:${a.text}`).join("|");
  if (key !== lastAlertKey) {
    lastAlertKey = key;
    alerts.value = trimmed;
  }
}

// P5: 告警定位 — 飞到问题地块 + 弹开详情面板
function locatePlot(plotId) {
  if (!plotId) return;
  // 让 3D 场景飞过去 + 选中
  sceneRef.value?.selectObject(plotId);
  // selectObject 会 emit("select", meta)，触发 onSelect 设置 selectedObj
  // 但为了保险（如果当前在 placement 模式会拦截），直接手动设一次
  if (placementType.value) placementType.value = null;
  // 同时触发一下闪烁高亮
  sceneRef.value?.flashObject?.(plotId, 0xfbbf24, 1200, true);
}

// P7: 聚合告警点击 → 一次性点亮同类全部地块（不移动相机，便于纵览全局）
function onAlertClick(alert) {
  if (alert?.plotIds && alert.plotIds.length > 1) {
    const color = alert.level === "danger" ? 0xff5a3c : 0xfbbf24;
    sceneRef.value?.highlightPlots?.(alert.plotIds, color, 3200);
    notify(`已高亮 ${alert.plotIds.length} 个${alert.issueLabel || ""}地块`);
    return;
  }
  locatePlot(alert?.plotId);
}

let clockTimer = 0;
let jitterTimer = 0;
let weatherTimer = 0;
let weatherRequestId = 0;
let displayedWeatherRegionKey = "";

function fmt(v) {
  return Number(v).toFixed(Number.isInteger(v) ? 0 : 1);
}

function pct(m) {
  return Math.max(4, Math.min(100, (m.value / m.max) * 100));
}

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function timeStr() {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function updateClock() {
  const d = new Date();
  now.value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function setWeather(key) {
  if (weatherMode.value !== "simulation") return;
  if (key === "custom") {
    enterCustomMode();
    return;
  }
  simulatedWeather.value = key;
  weather.value = key;
  weatherSnapshot.value = buildSnapshotFromKey(key);
}

function enterCustomMode() {
  if (weatherMode.value !== "simulation") return;
  weather.value = "custom";
  // 用当前滑块值生成 snapshot（空输入回退 sunny 预设）
  const snapshot = buildSnapshotFromSliders({
    temperature: sliderTemp.value,
    humidity: sliderHumidity.value,
    waterLevelCm: sliderWater.value,
    light: sliderLight.value,
    wind: sliderWind.value,
    rain: sliderRain.value,
  });
  weatherSnapshot.value = snapshot;
  syncPlotEnvironmentFromSnapshot(snapshot);
}

function syncPlotEnvironmentFromSnapshot(snapshot) {
  if (!snapshot) return;
  Object.values(plotStates).forEach((state) => {
    state.syncEnvironmentSnapshot(snapshot);
  });
  scanPlotAlerts();
}

function setWeatherSliders() {
  if (weatherMode.value !== "simulation" || weather.value !== "custom") return;
  const snapshot = buildSnapshotFromSliders({
    temperature: sliderTemp.value,
    humidity: sliderHumidity.value,
    waterLevelCm: sliderWater.value,
    light: sliderLight.value,
    wind: sliderWind.value,
    rain: sliderRain.value,
  });
  weatherSnapshot.value = snapshot;
  syncPlotEnvironmentFromSnapshot(snapshot);
}

function applyCustomWeather() {
  // 保持在 custom 模式，已通过 setWeatherSliders 实时更新 snapshot
  const snap = weatherSnapshot.value;
  syncPlotEnvironmentFromSnapshot(snap);
  try {
    localStorage.setItem(
      "agri-twin-custom-weather",
      JSON.stringify({
        temperature: snap.temperature,
        humidity: snap.humidity,
        waterLevelCm: snap.waterLevelCm,
        light: snap.light,
        wind: snap.wind,
        rain: snap.rain,
      })
    );
  } catch (_) { /* ignore */ }
  weatherDrawerOpen.value = false;
  notify("自定义完成");
}

function setWeatherMode(mode) {
  weatherMode.value = mode;
  if (mode === "actual") {
    loadRegionWeather(selectedRegion.value);
  } else {
    weatherRequestId += 1;
    setWeather(simulatedWeather.value);
  }
}

async function loadRegionWeather(region) {
  if (!region || !region.coordinates) return;
  if (!liveWeatherEnabled.value) return;

  const requestId = ++weatherRequestId;
  const { latitude, longitude } = region.coordinates;
  const cacheKey = `${WEATHER_CACHE_PREFIX}${region.key}:${latitude}:${longitude}`;
  const hasCurrentRegionWeather =
    displayedWeatherRegionKey === region.key && !!dailyTemperatureRange.value;
  let cached = null;

  // 1. 先尝试 localStorage 缓存（用于 UI 显示每日/预报）
  try {
    const raw = localStorage.getItem(cacheKey);
    const parsed = raw ? JSON.parse(raw) : null;
    if (
      parsed &&
      parsed.date === localDateKey() &&
      Number.isFinite(Date.parse(parsed.savedAt)) &&
      Date.now() - Date.parse(parsed.savedAt) >= 0 &&
      Date.now() - Date.parse(parsed.savedAt) <= WEATHER_CACHE_MAX_AGE_MS &&
      Number.isFinite(parsed.range?.min) &&
      Number.isFinite(parsed.range?.max) &&
      Array.isArray(parsed.forecastItems)
    ) {
      cached = parsed;
      if (!hasCurrentRegionWeather) {
        dailyTemperatureRange.value = parsed.range;
        const currentTime = `${pad(new Date().getHours())}:${pad(new Date().getMinutes())}`;
        forecastItems.value = parsed.forecastItems
          .filter((item) => typeof item.time === "string" && item.time > currentTime)
          .slice(0, 4);
        forecastMessage.value = "使用今日缓存预报";
        // 快照回退用 sunny preset（缓存里存的是 key，不是完整 snapshot）
        weather.value = parsed.weatherCode
          ? (WEATHER_CODE_MAP[Number(parsed.weatherCode)] || "cloudy")
          : "sunny";
        weatherSnapshot.value = buildSnapshotFromKey(weather.value);
        actualWeatherStatus.value = "cached";
        displayedWeatherRegionKey = region.key;
      }
    } else if (!hasCurrentRegionWeather) {
      dailyTemperatureRange.value = null;
      forecastItems.value = [];
      forecastMessage.value = "正在获取天气预报...";
      actualWeatherStatus.value = "loading";
      displayedWeatherRegionKey = "";
    }
  } catch (err) {
    console.warn("读取本地天气缓存失败", err);
    if (!hasCurrentRegionWeather) {
      dailyTemperatureRange.value = null;
      forecastItems.value = [];
      forecastMessage.value = "正在获取天气预报...";
      actualWeatherStatus.value = "loading";
    }
  }

  // 2. 直调 Open-Meteo（通过 weatherSource.js）
  try {
    const result = await fetchActualWeatherSnapshot({ lat: latitude, lon: longitude });
    if (requestId !== weatherRequestId || !liveWeatherEnabled.value) return;

    // snapshot 始终更新（来自 weatherState.js 的真实物理数值）
    weatherSnapshot.value = result.snapshot;
    weather.value = result.snapshot.key;

    if (result.status === "unavailable") {
      // weatherSource.js 已经返回 ACTUAL_WEATHER_DEFAULTS 作为 snapshot
      // 这里只处理 UI 状态
      if (cached) {
        forecastMessage.value = "网络暂不可用，当前显示今日缓存预报";
        actualWeatherStatus.value = "cached";
      } else {
        forecastItems.value = [];
        dailyTemperatureRange.value = null;
        forecastMessage.value = "天气预报暂时不可用，请检查网络";
        actualWeatherStatus.value = "unavailable";
        displayedWeatherRegionKey = "";
      }
      return;
    }

    // status === "ok"：处理 raw 里的 daily/hourly 预报数据
    const data = result.raw;
    const current = data.current || {};
    const daily = data.daily || {};

    const minimum = Number(daily.temperature_2m_min?.[0]);
    const maximum = Number(daily.temperature_2m_max?.[0]);
    if (Number.isFinite(minimum) && Number.isFinite(maximum)) {
      dailyTemperatureRange.value = { min: Math.round(minimum), max: Math.round(maximum) };
    }

    const times = data.hourly?.time || [];
    const temperatures = data.hourly?.temperature_2m || [];
    const codes = data.hourly?.weather_code || [];
    const currentTime = current.time || "";
    const upcoming = times
      .map((time, index) => ({ time, index }))
      .filter((item) => item.time > currentTime)
      .slice(0, 4);
    forecastItems.value = upcoming.map(({ time, index }) => {
      const forecast = WEATHER_CODE_MAP[Number(codes[index])] || "cloudy";
      return {
        time: time.slice(11, 16),
        key: forecast,
        temperature: Math.round(Number(temperatures[index])),
      };
    });
    if (!forecastItems.value.length) forecastMessage.value = "暂无后续时段预报";
    else forecastMessage.value = "";

    actualWeatherStatus.value = "live";
    displayedWeatherRegionKey = region.key;

    // 保存缓存（UI 显示用，含每日/预报数据）
    const nextCache = {
      date: localDateKey(),
      range: dailyTemperatureRange.value,
      forecastItems: forecastItems.value,
      weatherCode: current.weather_code,
      precipitation: current.precipitation,
      savedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(cacheKey, JSON.stringify(nextCache));
    } catch (err) {
      console.warn("保存本地天气缓存失败", err);
    }
  } catch (err) {
    if (requestId === weatherRequestId && liveWeatherEnabled.value) {
      if (cached) {
        forecastMessage.value = "网络暂不可用，当前显示今日缓存预报";
        actualWeatherStatus.value = "cached";
      } else {
        forecastItems.value = [];
        dailyTemperatureRange.value = null;
        forecastMessage.value = "天气预报暂时不可用，请检查网络";
        actualWeatherStatus.value = "unavailable";
        displayedWeatherRegionKey = "";
      }
    }
  }
}

function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function applyRegionalSoilPreset(regionKey) {
  const preset = REGION_SOIL_PROFILES[regionKey];
  if (!preset) return;
  soilMetrics.value.forEach((metric) => {
    metric.value = preset.metrics[metric.key];
  });
}

function doInspect() {
  // P5: 巡检也会触发一次即时告警扫描
  scanPlotAlerts();
  if (selectedObj.value?.type === "plot" && sceneRef.value) {
    sceneRef.value.flashObject(selectedObj.value.id, 0x00e5ff, 900, false);
  }
}

function dispatchNow() {
  const dispatched = sceneRef.value?.dispatchNow?.();
  if (!dispatched) return;
  scanPlotAlerts();
  notify("已执行一轮：环境前进 1 秒，控制设备按顺序调节一次");
}

watch(
  selectedRegion,
  (region) => {
    applyRegionalSoilPreset(region.key);
    if (liveWeatherEnabled.value) loadRegionWeather(region);
  },
  { deep: true }
);

onMounted(async () => {
  updateClock();
  scanPlotAlerts();           // 首次扫描
  clockTimer = setInterval(updateClock, 1000);
  alertsTimer = setInterval(scanPlotAlerts, 1000);  // P5: 每秒扫 — 和 simulation tick 对齐，UI 红 → 告警立即出
  jitterTimer = setInterval(() => {
    soilMetrics.value.forEach((m) => {
      if (m.step) m.value = clamp(m.value + (Math.random() - 0.5) * m.step, 0, m.max);
    });
  }, 2000);

  loadRegionWeather(selectedRegion.value);
  weatherTimer = setInterval(() => {
    if (liveWeatherEnabled.value) loadRegionWeather(selectedRegion.value);
  }, 5 * 60 * 1000);
  document.addEventListener("visibilitychange", onWeatherVisibilityChange);
  document.addEventListener("keydown", handleKeydown);

  try {
    soilProfileData.value = await getSoilProfile();
  } catch (err) {
    soilProfileData.value = {};
  }
});

function onWeatherVisibilityChange() {
  if (document.visibilityState === "visible" && liveWeatherEnabled.value) {
    loadRegionWeather(selectedRegion.value);
  }
}

onBeforeUnmount(() => {
  cancelAnimationFrame(harvestRaf);
  clearInterval(clockTimer);
  clearInterval(alertsTimer);
  clearInterval(jitterTimer);
  clearInterval(weatherTimer);
  document.removeEventListener("visibilitychange", onWeatherVisibilityChange);
  document.removeEventListener("keydown", handleKeydown);
});
</script>

<style scoped>
/* —— P1 视觉 Token —— 放在 .studio 下避免污染全局但全组件可用 */
.studio {
  /* 毛玻璃底色三级浓度（按面板层级选） */
  --glass-bg-low:   rgba(12, 18, 28, 0.42);
  --glass-bg-mid:   rgba(14, 22, 36, 0.62);
  --glass-bg-high:  rgba(16, 26, 42, 0.80);

  /* 性能模式：大面积面板不再对动态 WebGL 画布做实时模糊 */
  --glass-blur: 0px;

  /* 霓虹色系 */
  --accent-cyan:   #22d3ee;
  --accent-green:  #34d399;
  --accent-amber:  #fbbf24;
  --accent-rose:   #f43f5e;

  /* 边框 */
  --border-subtle: rgba(255, 255, 255, 0.06);
  --border-normal: rgba(255, 255, 255, 0.14);
  --border-glow-cyan: rgba(34, 211, 238, 0.5);
  --border-glow-green: rgba(52, 211, 153, 0.5);

  /* 圆角 */
  --radius-sm: 8px;
  --radius-md: 14px;
  --radius-lg: 20px;
  --radius-xl: 24px;

  /* 发光阴影 */
  --shadow-glow-cyan: 0 0 16px rgba(34, 211, 238, 0.35);
  --shadow-glow-green: 0 0 14px rgba(52, 211, 153, 0.30);
  --shadow-panel: 0 4px 24px rgba(0, 0, 0, 0.45);

  /* 动画 */
  --ease-smooth: cubic-bezier(0.22, 1, 0.36, 1);
  --duration-fast: 0.2s;
  --duration-normal: 0.28s;
}
.studio {
  position: relative;
  height: 100vh;
  min-height: 680px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: #e8f1ff;
  background:
    radial-gradient(1200px 600px at 70% -10%, rgba(0, 90, 160, 0.18), transparent 60%),
    radial-gradient(900px 500px at 10% 110%, rgba(0, 120, 140, 0.14), transparent 60%),
    #0a0e17;
}

.region-panel {
  padding: 15px 14px 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  background: linear-gradient(180deg, rgba(15, 32, 47, 0.96), rgba(10, 16, 30, 0.8));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.region-panel-head,
.detail-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.eyebrow {
  display: block;
  margin-bottom: 5px;
  color: #65809f;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.13em;
}

.region-count {
  padding: 5px 8px;
  border: 1px solid rgba(0, 229, 255, 0.18);
  border-radius: 999px;
  color: #79bad5;
  font-size: 10px;
}

.region-switcher {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 7px;
  margin: 14px 0 8px;
}

.region-chip {
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  gap: 7px;
  min-width: 0;
  border: 1px solid rgba(143, 212, 255, 0.2);
  background: rgba(143, 212, 255, 0.08);
  color: #dfeeff;
  padding: 8px 9px;
  border-radius: 9px;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.region-chip:last-child {
  grid-column: 1 / -1;
}

.region-chip-dot {
  width: 7px;
  height: 7px;
  flex: 0 0 7px;
  border-radius: 50%;
  background: #61758f;
}

.region-chip.active {
  background: linear-gradient(135deg, rgba(0, 229, 255, 0.26), rgba(97, 160, 255, 0.26));
  border-color: rgba(0, 229, 255, 0.52);
  box-shadow: 0 0 18px rgba(0, 229, 255, 0.18);
}

.region-chip.active .region-chip-dot {
  background: #00e5ff;
  box-shadow: 0 0 8px #00e5ff;
}

/* —— P3: Accordion Toggle 按钮 —— */
.accordion-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  margin-top: 10px;
  padding: 8px 12px;
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.02);
  color: #8aa0aa;
  font: inherit;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s, color 0.2s;
}
.accordion-toggle:hover {
  background: rgba(34, 211, 238, 0.06);
  border-color: rgba(34, 211, 238, 0.25);
  color: var(--accent-cyan);
}
.accordion-toggle-label { text-transform: uppercase; }
.accordion-toggle-arrow {
  display: inline-block;
  font-size: 16px;
  transform: rotate(90deg);
  transition: transform 0.3s var(--ease-smooth);
  color: #8aa0aa;
}
.accordion-toggle-arrow.open {
  transform: rotate(-90deg);
  color: var(--accent-cyan);
}

.region-summary {
  padding: 10px 0 0;
  border-top: 1px solid rgba(255, 255, 255, 0.07);
}

.region-summary-name {
  font-size: 14px;
  font-weight: 700;
  color: #edf7ff;
}

.region-summary p {
  margin: 6px 0 9px;
  color: rgba(220, 236, 255, 0.8);
  font-size: 11px;
  line-height: 1.6;
}

.terrain-summary {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
  padding: 8px;
  border: 1px solid rgba(0, 229, 255, 0.14);
  border-radius: 9px;
  background: rgba(0, 229, 255, 0.055);
  font-size: 10px;
}

.terrain-summary span {
  flex: 0 0 auto;
  color: #7692b0;
}

.terrain-summary strong {
  color: #8fe6f3;
  font-weight: 600;
  text-align: right;
}

.region-summary ul {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 6px;
}

.region-summary li {
  display: grid;
  grid-template-columns: 35px minmax(0, 1fr);
  align-items: start;
  gap: 8px;
  font-size: 10px;
  padding: 7px 8px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.035);
  color: #dce9ff;
}

.region-summary li > span {
  color: #8198b5;
}

.region-summary strong {
  font-weight: 600;
  color: #a7f3ff;
  text-align: right;
  line-height: 1.45;
}

.weather-summary-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: auto;
}

.weather-summary-head .panel-title,
.region-panel .panel-title,
.detail-heading .panel-title {
  margin-bottom: 0;
}

.detail-clear {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 5px;
  padding: 6px 10px 6px 7px;
  border: 1px solid rgba(126, 181, 220, 0.24);
  border-radius: 999px;
  background: linear-gradient(135deg, rgba(47, 91, 126, 0.24), rgba(17, 35, 54, 0.62));
  color: #a9c5dc;
  font: inherit;
  font-size: 11px;
  line-height: 1;
  cursor: pointer;
  transition: color 0.18s ease, border-color 0.18s ease, background 0.18s ease, transform 0.18s ease;
}

.detail-clear:hover {
  transform: translateY(-1px);
  border-color: rgba(91, 216, 240, 0.55);
  background: linear-gradient(135deg, rgba(26, 128, 157, 0.36), rgba(25, 55, 81, 0.8));
  color: #d8f8ff;
}

.detail-clear:focus-visible {
  outline: 2px solid #5bd8f0;
  outline-offset: 2px;
}

.detail-clear-icon {
  display: grid;
  width: 16px;
  height: 16px;
  place-items: center;
  border-radius: 50%;
  background: rgba(137, 186, 218, 0.12);
  color: inherit;
  font-size: 15px;
}

.weather-source-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #8290a4;
}

.weather-source-dot.is-live {
  background: #34d399;
  box-shadow: 0 0 9px rgba(52, 211, 153, 0.8);
}

.weather-source-dot.is-cached {
  background: #fbbf24;
  box-shadow: 0 0 9px rgba(251, 191, 36, 0.65);
}

.weather-now-copy {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.weather-region {
  color: #8299b5;
  font-size: 10px;
}

.region-badge {
  padding: 5px 9px;
  border: 1px solid rgba(0, 229, 255, 0.18);
  border-radius: 999px;
  color: #9bddeb;
  font-size: 10px;
  letter-spacing: 0;
}

.weather-mode-label {
  margin-left: auto;
  border: 1px solid rgba(150, 211, 255, 0.24);
  background: rgba(44, 101, 158, 0.18);
  color: #dff7ff;
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 10px;
}

/* —— 顶栏 —— */
.studio-top {
  flex: 0 0 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  gap: 20px;
  border-bottom: 1px solid rgba(0, 229, 255, 0.16);
  background: rgba(10, 16, 30, 0.7);
}

.back-btn {
  border: 1px solid rgba(0, 229, 255, 0.3);
  background: rgba(0, 229, 255, 0.08);
  color: #8ce4ff;
  font-size: 13px;
  padding: 7px 16px;
  border-radius: 980px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.back-btn:hover {
  background: rgba(0, 229, 255, 0.16);
  color: #e8f1ff;
}

.studio-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 15px;
  letter-spacing: 0.04em;
  font-weight: 500;
  min-width: 0;
}

.title-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #00e5ff;
  box-shadow: 0 0 10px #00e5ff, 0 0 20px #00e5ff;
  animation: blink 1.8s ease-in-out infinite;
}

.live-badge {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: #0a0e17;
  background: #34d399;
  padding: 3px 8px;
  border-radius: 4px;
  box-shadow: 0 0 12px rgba(52, 211, 153, 0.6);
}

.studio-clock {
  font-size: 14px;
  color: #8aa0c0;
  letter-spacing: 0.04em;
}

/* —— 主体控制台 —— */
.studio-main {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(210px, 0.72fr) minmax(0, 2.35fr) minmax(300px, 0.92fr);
  grid-template-areas: "regions scene details";
  gap: 14px;
  padding: 14px;
}

.studio-main.is-plot-focused {
  grid-template-columns: minmax(200px, 0.66fr) minmax(0, 2.15fr) minmax(380px, 1.08fr);
}

.side-panel {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow: auto;
}

.region-sidebar {
  grid-area: regions;
}

.detail-sidebar {
  grid-area: details;
}

.detail-sidebar.plot-detail-active {
  gap: 10px;
  overflow-x: hidden;
  overflow-y: auto;
}

.scene-wrap {
  grid-area: scene;
  min-width: 0;
  min-height: 360px;
}

/* 窄屏：场景置顶，面板下移，避免三栏挤压画布 */
@media (max-width: 1180px) {
  .studio-main {
    flex: 0 1 auto;
    grid-template-columns: minmax(0, 1fr) minmax(320px, 0.9fr);
    grid-template-areas:
      "scene scene"
      "regions details";
    overflow-y: auto;
  }

  .studio-main.is-plot-focused {
    grid-template-columns: minmax(0, 1.15fr) minmax(320px, 0.85fr);
    grid-template-areas:
      "scene details"
      "regions regions";
  }

  .studio-main .scene-wrap {
    height: 46vh;
    min-height: 300px;
  }

  .studio-title {
    gap: 7px;
    font-size: 13px;
  }

  .studio-bottom {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .studio-bottom .bottom-panel:last-child {
    grid-column: 1 / -1;
  }
}

@media (max-width: 760px) {
  .studio {
    height: auto;
    min-height: 100vh;
    overflow: visible;
  }

  .studio-top {
    position: sticky;
    top: 0;
    z-index: 20;
    height: auto;
    min-height: 56px;
    padding: 8px 12px;
    gap: 8px;
  }

  .studio-title {
    flex: 1;
    flex-wrap: wrap;
  }

  .title-text {
    font-size: 12px;
  }

  .region-badge {
    display: none;
  }

  .studio-clock {
    font-size: 10px;
  }

  .studio-main {
    display: flex;
    flex-direction: column;
    overflow: visible;
  }

  .studio-main .scene-wrap {
    order: -1;
    height: 52vh;
    min-height: 300px;
    flex: 0 0 auto;
  }

  .studio-main .side-panel {
    flex: 0 0 auto;
    max-height: none;
  }

  .studio-bottom {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    padding: 0 14px 14px;
  }

  .studio-bottom .bottom-panel:last-child {
    grid-column: auto;
  }

  .scene-legend {
    left: 8px;
    right: 8px;
    justify-content: center;
    gap: 8px;
    font-size: 10px;
  }
}

.scene-wrap {
  flex: 1;
  position: relative;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(0, 229, 255, 0.22);
  box-shadow: inset 0 0 40px rgba(0, 120, 160, 0.12);
}

.scan-line {
  position: absolute;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, rgba(0, 229, 255, 0.7), transparent);
  animation: scan 5s linear infinite;
  pointer-events: none;
}

.scene-view-switch {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 2;
  display: inline-flex;
  gap: 3px;
  padding: 3px;
  border: 1px solid rgba(0, 229, 255, 0.2);
  border-radius: 8px;
  background: rgba(8, 19, 29, 0.78);
  backdrop-filter: blur(8px);
}

.scene-view-switch button {
  padding: 5px 9px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #7898a8;
  font: inherit;
  font-size: 10px;
  font-weight: 600;
  cursor: pointer;
  transition: color 0.18s ease, background 0.18s ease;
}

.scene-view-switch button:hover {
  color: #c8f7ff;
  background: rgba(34, 211, 238, 0.1);
}

.scene-view-switch button.active {
  color: #061b20;
  background: #5eead4;
}

.scene-hint {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 12px;
  color: #6f87a8;
  letter-spacing: 0.05em;
  padding: 6px 14px;
  border-radius: 980px;
  background: rgba(10, 16, 30, 0.6);
  border: 1px solid rgba(0, 229, 255, 0.18);
  pointer-events: none;
}

.scene-legend {
  position: absolute;
  right: 12px;
  bottom: 12px;
  display: flex;
  gap: 14px;
  font-size: 12px;
  color: #8aa0c0;
  padding: 7px 12px;
  border-radius: 980px;
  background: rgba(10, 16, 30, 0.6);
  border: 1px solid rgba(0, 229, 255, 0.18);
  pointer-events: none;
}

.scene-legend .lg {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 4px;
  vertical-align: middle;
}

.lg.normal {
  background: #34d399;
  box-shadow: 0 0 8px #34d399;
}

.lg.warning {
  background: #ff9f0a;
  box-shadow: 0 0 8px #ff9f0a;
}

.lg.device {
  background: #00e5ff;
  box-shadow: 0 0 8px #00e5ff;
}

/* —— 选中对象信息面板 —— */
.tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 980px;
  border: 1px solid transparent;
  white-space: nowrap;
}

.tag-green {
  color: #7bf0c2;
  background: rgba(52, 211, 153, 0.14);
  border-color: rgba(52, 211, 153, 0.4);
}

.tag-orange {
  color: #ffc76b;
  background: rgba(255, 159, 10, 0.14);
  border-color: rgba(255, 159, 10, 0.42);
}

.tag-red {
  color: #ff8a84;
  background: rgba(255, 59, 48, 0.14);
  border-color: rgba(255, 59, 48, 0.42);
}

.object-panel {
  position: absolute;
  top: 14px;
  left: 14px;
  width: 256px;
  padding: 14px;
  border-radius: 12px;
  background: rgba(9, 18, 30, 0.82);
  border: 1px solid rgba(0, 229, 255, 0.32);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(var(--glass-blur, 0px));
  animation: fadeIn 0.25s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.obj-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.obj-name {
  flex: 1;
  font-size: 15px;
  font-weight: 600;
  color: #dff4ff;
}

.obj-close {
  border: none;
  background: transparent;
  color: #6f87a8;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  padding: 0 2px;
}

.obj-close:hover {
  color: #cfeaff;
}

.obj-desc {
  margin-top: 8px;
  font-size: 12px;
  line-height: 1.6;
  color: #8aa0c0;
}

.regional-soil-note {
  margin: 8px 0 0;
  color: #8ba9c3;
  font-size: 10px;
  line-height: 1.5;
}

.obj-metrics {
  margin-top: 10px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

@media (min-width: 1181px) {
  .plot-metrics-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .plot-metrics-grid .obj-metric.is-wide {
    grid-column: span 2;
  }
}

.plot-warning-panel,
.plot-components-panel,
.component-detail {
  margin-top: 12px;
  padding: 10px 11px;
  border: 1px solid rgba(115, 180, 190, 0.16);
  border-radius: 10px;
  background: rgba(5, 18, 26, 0.42);
}

.plot-section-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: #c9e2e8;
  font-size: 11px;
  font-weight: 700;
}

.normal-count,
.warning-count {
  font-size: 10px;
  font-weight: 500;
}

.normal-count {
  color: #6ed2a4;
}

.warning-count {
  color: #ffbd69;
}

.plot-warning-list {
  display: grid;
  gap: 7px;
  margin: 9px 0 0;
  padding: 0;
  list-style: none;
}

.plot-warning-list li {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  color: #ffc779;
  font-size: 10px;
  line-height: 1.45;
}

.plot-warning-dot {
  flex: 0 0 6px;
  width: 6px;
  height: 6px;
  margin-top: 4px;
  border-radius: 50%;
  background: #ffb84d;
  box-shadow: 0 0 8px rgba(255, 184, 77, 0.55);
}
.plot-warning-dot.is-warning {
  background: #fbbf24;
  box-shadow: 0 0 8px rgba(251, 191, 36, 0.6);
}
.plot-warning-dot.is-danger {
  background: #f43f5e;
  box-shadow: 0 0 8px rgba(244, 63, 94, 0.65);
}

.plot-empty-state {
  margin: 8px 0 0;
  color: #7f9ba5;
  font-size: 10px;
  line-height: 1.5;
}

.plot-component-list {
  display: grid;
  gap: 6px;
  margin-top: 9px;
}

.plot-component-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  padding: 6px 7px;
  border: 1px solid rgba(115, 180, 190, 0.12);
  border-radius: 8px;
  background: rgba(15, 34, 41, 0.55);
}

.plot-component-name,
.component-row-action {
  border: 0;
  background: transparent;
  color: #b7d0d6;
  font: inherit;
  font-size: 10px;
  cursor: pointer;
}

.plot-component-name {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
  padding: 0;
  text-align: left;
}

.component-row-action {
  flex: 0 0 auto;
  color: #85d8e4;
}

.component-row-action.remove,
.component-remove-btn {
  color: #ff9a91;
}

.component-state-dot {
  width: 6px;
  height: 6px;
  flex: 0 0 6px;
  border-radius: 50%;
  background: #54dfaa;
  box-shadow: 0 0 7px rgba(84, 223, 170, 0.5);
}

.component-state-dot.disabled {
  background: #84919b;
  box-shadow: none;
}

.component-detail {
  display: grid;
  gap: 10px;
}

.component-detail-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
  color: #829ba8;
  font-size: 10px;
}

.component-detail-row strong {
  color: #c6e1e6;
  font-weight: 600;
  text-align: right;
}

.component-camera-view {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px;
  border: 1px solid rgba(0, 229, 255, 0.16);
  border-radius: 8px;
  background: rgba(0, 229, 255, 0.05);
  color: #8faab6;
  font-size: 10px;
}

.component-camera-view .obj-btn {
  margin: 0;
}

.component-camera-view .obj-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.component-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}

/* —— P3 秋收结算报告 —— */
.harvest-overlay {
  position: absolute;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(4, 8, 14, 0.52);
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
}

.harvest-report {
  width: min(520px, calc(100vw - 40px));
  padding: 22px 24px 20px;
  border-radius: 20px;
  background: linear-gradient(160deg, rgba(12, 22, 34, 0.95), rgba(8, 14, 24, 0.96));
  border: 1px solid rgba(94, 234, 212, 0.42);
  box-shadow:
    0 18px 60px rgba(0, 0, 0, 0.65),
    0 0 30px rgba(45, 212, 191, 0.22),
    inset 0 1px 0 rgba(255, 255, 255, 0.06);
  color: #e8f1ff;
}

.hr-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.hr-eyebrow {
  font-size: 9.5px;
  font-weight: 700;
  letter-spacing: 0.18em;
  color: #5eead4;
}

.hr-title {
  margin: 6px 0 0;
  font-size: 20px;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: #f3fffd;
  text-shadow: 0 0 18px rgba(94, 234, 212, 0.35);
}

.hr-close {
  flex: 0 0 auto;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 1px solid rgba(148, 163, 184, 0.28);
  background: rgba(255, 255, 255, 0.05);
  color: #9fb4c4;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  transition: all 0.18s ease;
}

.hr-close:hover {
  color: #f3fffd;
  border-color: rgba(94, 234, 212, 0.5);
}

.hr-hero {
  display: flex;
  gap: 20px;
  align-items: center;
  margin-top: 18px;
  padding: 16px;
  border-radius: 14px;
  background: rgba(45, 212, 191, 0.07);
  border: 1px solid rgba(45, 212, 191, 0.2);
}

.hr-yield {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-right: 20px;
  border-right: 1px solid rgba(94, 234, 212, 0.18);
}

.hr-yield-num {
  font-size: 40px;
  font-weight: 800;
  line-height: 1;
  color: #facc15;
  text-shadow: 0 0 22px rgba(250, 204, 21, 0.4);
}

.hr-yield-unit {
  margin-top: 4px;
  font-size: 11px;
  color: #8ca5ae;
}

.hr-yield-label {
  margin-top: 8px;
  font-size: 10.5px;
  letter-spacing: 0.1em;
  color: #6e8b98;
}

.hr-metrics {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
}

.hr-metric {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 12px;
}

.hr-metric-label {
  color: #8aa6b4;
}

.hr-metric-value {
  font-size: 15px;
  font-weight: 700;
  color: #a7f3d0;
}

.hr-note {
  margin: 14px 0 0;
  font-size: 10.5px;
  color: #64818e;
}

.hr-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 18px;
  flex-wrap: wrap;
}

.hr-done {
  margin-right: auto;
  font-size: 11.5px;
  color: #5eead4;
}

.hr-btn {
  padding: 9px 18px;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.26);
  background: rgba(255, 255, 255, 0.05);
  color: #c8dbe2;
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.18s ease;
}

.hr-btn:hover {
  border-color: rgba(94, 234, 212, 0.45);
  color: #f3fffd;
}

.hr-btn-primary {
  border-color: rgba(94, 234, 212, 0.55);
  background: linear-gradient(135deg, rgba(45, 212, 191, 0.9), rgba(16, 185, 129, 0.9));
  color: #04231d;
  box-shadow: 0 0 18px rgba(45, 212, 191, 0.35);
}

.hr-btn-primary:hover {
  color: #04231d;
  box-shadow: 0 0 26px rgba(45, 212, 191, 0.55);
}

.hr-btn:disabled {
  opacity: 0.65;
  cursor: progress;
}

.report-fade-enter-active,
.report-fade-leave-active {
  transition: opacity 0.22s ease;
}

.report-fade-enter-from,
.report-fade-leave-to {
  opacity: 0;
}

/* —— P2/P3 组件工具栏：悬浮 HUD 化 —— */
.component-toolbar {
  position: relative;
  bottom: auto;
  left: auto;
  transform: none;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 14px;
  width: min(1120px, calc(100vw - 28px));
  margin: 8px auto 14px;
  padding: 10px 16px;
  border-radius: 12px;
  background: var(--glass-bg-high);        /* 最顶层毛玻璃 */
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  border: 1px solid var(--border-normal);
  box-shadow:
    var(--shadow-panel),
    0 4px 24px rgba(0, 0, 0, 0.5);
  max-width: none;
}

.toolbar-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.toolbar-group-title {
  flex: 1 1 auto;
}

.toolbar-scope-switch {
  display: inline-flex;
  gap: 3px;
  margin-left: 4px;
  padding: 2px;
  border: 1px solid rgba(0, 229, 255, 0.16);
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.2);
}

.toolbar-scope-switch button {
  padding: 4px 9px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #7898a8;
  font: inherit;
  font-size: 10px;
  font-weight: 600;
  cursor: pointer;
}

.toolbar-scope-switch button.active {
  background: rgba(94, 234, 212, 0.92);
  color: #06231e;
}

.toolbar-categories {
  flex: 1 1 100%;
  order: 3;
  display: flex;
  align-items: flex-start;
  gap: 10px 16px;
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.tool-category {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.tool-category-label {
  color: #607f8b;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.tool-category-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.toolbar-group-buttons {
  flex: 1;
  justify-content: center;
  flex-wrap: wrap;
}

.toolbar-group-actions {
  order: 2;
  margin-left: auto;
  gap: 10px;
}

.toolbar-title {
  font-size: 11px;
  font-weight: 700;
  color: #6e94a0;
  letter-spacing: 0.08em;
}

.tool-core-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent-cyan);
  box-shadow: var(--shadow-glow-cyan);
  animation: pulse-dot 2s ease-in-out infinite;
}

/* —— 胶囊按钮核心 —— */
.tool-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 999px;
  border: 1px solid var(--border-subtle);
  background: var(--glass-bg-mid);
  color: #c8dbe2;
  font: inherit;
  font-size: 11.5px;
  font-weight: 500;
  cursor: pointer;
  transition:
    transform var(--duration-fast) var(--ease-smooth),
    border-color var(--duration-normal) var(--ease-smooth),
    background var(--duration-normal) var(--ease-smooth),
    box-shadow var(--duration-normal) var(--ease-smooth),
    color var(--duration-normal) var(--ease-smooth);
}

.tool-pill:hover {
  transform: translateY(-2px);
  border-color: var(--border-normal);
  background: rgba(34, 211, 238, 0.10);
  color: #e5f9ff;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.45);
}

.tool-pill.active {
  background: rgba(34, 211, 238, 0.20);
  border-color: var(--accent-cyan);
  box-shadow:
    var(--shadow-glow-cyan),
    inset 0 0 12px rgba(34, 211, 238, 0.15);
  color: var(--accent-cyan);
}

.tool-pill-cancel {
  background: rgba(244, 63, 94, 0.12);
  border-color: rgba(244, 63, 94, 0.35);
  color: #fda4b5;
}
.tool-pill-cancel:hover {
  background: rgba(244, 63, 94, 0.20);
  border-color: var(--accent-rose);
  color: var(--accent-rose);
  box-shadow: 0 0 12px rgba(244, 63, 94, 0.25);
}

.tool-pill-inspect {
  background: var(--glass-bg-low);
  border-color: rgba(52, 211, 153, 0.30);
  color: #86efac;
}
.tool-pill-inspect:hover {
  background: rgba(52, 211, 153, 0.15);
  border-color: var(--accent-green);
  box-shadow: var(--shadow-glow-green);
}

.tool-pill-dispatch {
  border-color: rgba(251, 191, 36, 0.38);
  background: rgba(251, 191, 36, 0.08);
  color: #fcd34d;
}

.tool-pill-dispatch:hover {
  border-color: rgba(251, 191, 36, 0.65);
  background: rgba(251, 191, 36, 0.14);
  box-shadow: 0 0 14px rgba(251, 191, 36, 0.18);
}

.tool-icon {
  width: 16px;
  height: 16px;
  stroke: currentColor;
  transition: stroke var(--duration-normal) var(--ease-smooth);
}

.tool-label {
  white-space: nowrap;
}

/* —— 放置模式提示 —— */
.placement-hint {
  color: #6e94a0;
  font-size: 10.5px;
}
.placement-hint kbd {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid var(--border-subtle);
  font-size: 10px;
  font-family: inherit;
}

/* —— Toast 弹窗 —— */
.placement-toast {
  position: fixed;
  top: 80px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 10px 22px;
  border-radius: var(--radius-lg);
  background: var(--glass-bg-high);
  backdrop-filter: blur(var(--glass-blur, 0px));
  -webkit-backdrop-filter: blur(var(--glass-blur, 0px));
  border: 1px solid var(--accent-cyan);
  box-shadow:
    var(--shadow-glow-cyan),
    0 8px 32px rgba(0, 0, 0, 0.5);
  color: #cdf4fa;
  font-size: 12px;
  white-space: nowrap;
}
.placement-toast strong {
  color: var(--accent-cyan);
  font-weight: 600;
}
.placement-toast kbd {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.10);
  border: 1px solid var(--border-normal);
  font-size: 10px;
  font-family: inherit;
}

.toast-pulse {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent-cyan);
  box-shadow: var(--shadow-glow-cyan);
  animation: pulse-dot 1.4s ease-in-out infinite;
}

.toast-fade-enter-active,
.toast-fade-leave-active {
  transition: opacity 0.28s var(--ease-smooth),
              transform 0.28s var(--ease-smooth);
}
.toast-fade-enter-from,
.toast-fade-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-12px);
}

/* —— 关键帧 —— */
@keyframes pulse-dot {
  0%, 100% { opacity: 1;   transform: scale(1); }
  50%      { opacity: 0.55; transform: scale(0.75); }
}
@keyframes flow {
  to { background-position: 200% 0; }
}

/* 删除旧样式的引用点：.obj-metric 等后面有引用 */


.obj-metric {
  padding: 7px 9px;
  border-radius: 8px;
  background: rgba(0, 229, 255, 0.06);
  border: 1px solid rgba(0, 229, 255, 0.12);
  transition: border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;
}

.obj-metric-label {
  display: block;
  font-size: 11px;
  color: #7c93b3;
}

.obj-metric-value {
  display: block;
  margin-top: 2px;
  font-size: 15px;
  font-weight: 600;
  color: #e8f1ff;
}

.obj-metric-value i {
  font-style: normal;
  font-size: 11px;
  font-weight: 400;
  color: #8aa0c0;
  margin-left: 2px;
}

.obj-metric-reason,
.obj-metric-advice {
  display: block;
  margin-top: 3px;
  font-size: 9px;
  line-height: 1.38;
}

.obj-metric-reason {
  color: #94a9bd;
}

.obj-metric-advice {
  padding-top: 3px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  color: #8aa0b7;
}

.obj-metric.is-warning {
  border-color: rgba(251, 191, 36, 0.48);
  background: rgba(251, 191, 36, 0.1);
}

.obj-metric.is-warning .obj-metric-label,
.obj-metric.is-warning .obj-metric-value i {
  color: #d7aa4c;
}

.obj-metric.is-warning .obj-metric-value {
  color: #fcd34d;
}

.obj-metric.is-warning .obj-metric-reason,
.obj-metric.is-warning .obj-metric-advice {
  color: #d8b45e;
}

.obj-metric.is-danger {
  border-color: rgba(244, 63, 94, 0.65);
  background: rgba(244, 63, 94, 0.13);
  box-shadow: inset 0 0 12px rgba(244, 63, 94, 0.08), 0 0 10px rgba(244, 63, 94, 0.12);
}

.obj-metric.is-danger .obj-metric-label,
.obj-metric.is-danger .obj-metric-value i {
  color: #f3a0ad;
}

.obj-metric.is-danger .obj-metric-value {
  color: #ff6b81;
  text-shadow: 0 0 10px rgba(244, 63, 94, 0.28);
}

.obj-metric.is-danger .obj-metric-reason,
.obj-metric.is-danger .obj-metric-advice {
  color: #f3a0ad;
}

.obj-actions {
  margin-top: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.obj-btn {
  border: 1px solid rgba(0, 229, 255, 0.35);
  background: rgba(0, 229, 255, 0.08);
  color: #9fe8ff;
  font-size: 12px;
  padding: 6px 10px;
  border-radius: 980px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.obj-btn:hover {
  background: rgba(0, 229, 255, 0.18);
}

.obj-btn.active {
  background: rgba(52, 211, 153, 0.2);
  border-color: rgba(52, 211, 153, 0.6);
  color: #7bf0c2;
}

/* —— 土壤剖面 —— */
.soil-profile {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid rgba(0, 229, 255, 0.16);
}

.sp-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: #cfeaff;
  letter-spacing: 0.04em;
  margin-bottom: 10px;
}

.sp-depth-total {
  font-size: 11px;
  color: #7c93b3;
}

.sp-body {
  display: flex;
  gap: 10px;
}

.sp-stack {
  width: 34px;
  height: 132px;
  display: flex;
  flex-direction: column;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid rgba(0, 229, 255, 0.22);
}

.sp-layer {
  width: 100%;
  min-height: 8px;
  box-shadow: inset 0 0 10px rgba(0, 0, 0, 0.35);
}

.sp-list {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.sp-item {
  padding: 4px 0;
}

.sp-name-row {
  display: flex;
  align-items: center;
  gap: 5px;
}

.sp-swatch {
  width: 8px;
  height: 8px;
  border-radius: 2px;
}

.sp-name {
  font-size: 11px;
  color: #cfeaff;
}

.sp-range {
  margin-left: auto;
  font-size: 10px;
  color: #7c93b3;
}

.sp-vals {
  margin-top: 2px;
  font-size: 10px;
  color: #8aa0c0;
}

/* —— 底部三栏 —— */
.studio-bottom {
  flex: 0 0 auto;
  display: flex;
  gap: 14px;
  padding: 0 14px 14px;
}

.bottom-panel {
  flex: 1;
}

/* —— 通用科技面板 —— */
.panel {
  position: relative;
  border-radius: var(--radius-md);      /* 14px 大圆角 */
  padding: 16px;
  background: var(--glass-bg-mid);       /* 毛玻璃底 */
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  border: 1px solid var(--border-normal);
  box-shadow: var(--shadow-panel);
  overflow: hidden;
}

.panel.side-panel {
  overflow-x: hidden;
  overflow-y: auto;
  scrollbar-gutter: stable;
  overscroll-behavior: contain;
}

.panel.side-panel::-webkit-scrollbar {
  width: 6px;
}

.panel.side-panel::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.035);
  border-radius: 3px;
}

.panel.side-panel::-webkit-scrollbar-thumb {
  background: rgba(94, 234, 212, 0.34);
  border-radius: 3px;
}

.panel.side-panel::-webkit-scrollbar-thumb:hover {
  background: rgba(94, 234, 212, 0.55);
}

.panel::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--accent-cyan), transparent);
  background-size: 200% 100%;
  animation: flow 3s linear infinite;
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.06em;
  color: #cfeaff;
  margin: 0 0 14px;
}

.panel-title::before {
  content: "";
  width: 4px;
  height: 14px;
  border-radius: 2px;
  background: #00e5ff;
  box-shadow: 0 0 10px #00e5ff;
}

/* —— 天气当前状态 —— */
.weather-now {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  margin-bottom: 12px;
  border-radius: 10px;
  background: rgba(0, 229, 255, 0.06);
  border: 1px solid rgba(0, 229, 255, 0.14);
}

.weather-emoji {
  font-size: 24px;
  line-height: 1;
}

.weather-label {
  font-size: 18px;
  font-weight: 600;
  color: #e8f1ff;
}

.soil-summary {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #8aa0c0;
  margin-bottom: 12px;
}

.soil-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #34d399;
  box-shadow: 0 0 8px #34d399;
  animation: blink 2s ease-in-out infinite;
}

/* —— 指标 —— */
.metric-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
}

.metric-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 5px;
}

.metric-label {
  font-size: 12px;
  color: #8aa0c0;
  letter-spacing: 0.03em;
}

.metric-value {
  font-size: 18px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.metric-value .unit {
  font-size: 11px;
  font-weight: 400;
  margin-left: 2px;
  color: #6f87a8;
}

.metric-bar {
  height: 4px;
  border-radius: 980px;
  background: rgba(255, 255, 255, 0.08);
  overflow: hidden;
}

.metric-fill {
  display: block;
  height: 100%;
  border-radius: 980px;
  box-shadow: 0 0 8px currentColor;
  transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

.plot-structure {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.plot-structure > div {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 9px;
  border: 1px solid rgba(143, 212, 255, 0.14);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.035);
}

.plot-structure strong {
  color: #d7f6ff;
  font-size: 14px;
}

.plot-structure span {
  color: #91a8c6;
  font-size: 10px;
}

/* —— 天气联动 —— */
.weather-mode-switch {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}

.weather-mode-btn {
  flex: 1;
  border: 1px solid rgba(0, 229, 255, 0.22);
  border-radius: 8px;
  padding: 7px 0;
  background: rgba(255, 255, 255, 0.03);
  color: #8aa0c0;
  font-size: 12px;
  cursor: pointer;
}

.weather-mode-btn.active {
  border-color: rgba(0, 229, 255, 0.6);
  background: rgba(0, 229, 255, 0.14);
  color: #a7f3ff;
}

.forecast-list {
  min-height: 48px;
  margin-bottom: 10px;
}

.forecast-items {
  display: flex;
  gap: 5px;
}

.forecast-item {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 5px 2px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.035);
  color: #cfeaff;
}

.forecast-time,
.forecast-temp {
  font-size: 11px;
}

.forecast-icon {
  font-size: 16px;
  line-height: 1;
}

.forecast-label {
  overflow: hidden;
  max-width: 100%;
  color: #8aa0c0;
  font-size: 9px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.forecast-empty {
  padding: 14px 4px;
  color: #8aa0c0;
  font-size: 11px;
  text-align: center;
}

.weather-btns {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.weather-btn {
  flex: 1;
  border: 1px solid rgba(0, 229, 255, 0.22);
  background: rgba(0, 229, 255, 0.05);
  color: #8ce4ff;
  font-size: 13px;
  padding: 8px 0;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.weather-btn:hover {
  border-color: rgba(0, 229, 255, 0.5);
}

.weather-btn.active {
  background: rgba(0, 229, 255, 0.2);
  border-color: #00e5ff;
  color: #e8f1ff;
  box-shadow: 0 0 14px rgba(0, 229, 255, 0.35);
}

.weather-drawer {
  width: 430px;
  max-width: 94vw;
}

.custom-weather-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px;
  border: 1px solid rgba(94, 234, 212, 0.16);
  border-radius: 12px;
  background: linear-gradient(180deg, rgba(10, 29, 36, 0.82), rgba(7, 20, 28, 0.62));
}

.custom-weather-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.custom-weather-head .drawer-subtitle-sm {
  margin: 0;
  color: #c9f4ee;
  font-size: 12px;
}

.custom-weather-stage {
  display: block;
  margin-top: 4px;
  color: #6f9ba4;
  font-size: 9px;
}

.weather-reset-btn {
  flex: 0 0 auto;
  padding: 5px 9px;
  border: 1px solid rgba(250, 204, 21, 0.35);
  border-radius: 7px;
  background: rgba(250, 204, 21, 0.08);
  color: #fde68a;
  font: inherit;
  font-size: 10px;
  cursor: pointer;
}

.weather-reset-btn:hover {
  background: rgba(250, 204, 21, 0.16);
  border-color: rgba(250, 204, 21, 0.65);
}

.weather-param-group {
  display: grid;
  gap: 7px;
}

.weather-group-title {
  margin-top: 2px;
  color: #648691;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.12em;
}

.weather-param-card {
  display: grid;
  gap: 7px;
  padding: 9px 10px;
  border: 1px solid rgba(125, 211, 252, 0.14);
  border-radius: 9px;
  background: rgba(2, 12, 18, 0.34);
}

.weather-param-card.compact {
  padding: 8px 10px;
}

.weather-param-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  color: #b8d5da;
  font-size: 11px;
  font-weight: 600;
}

.weather-param-value {
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
}

.weather-param-value input {
  width: 68px;
  padding: 3px 6px;
  border: 1px solid rgba(125, 211, 252, 0.2);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.04);
  color: #e7fbff;
  font: inherit;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.weather-param-value input:focus {
  outline: none;
  border-color: #5eead4;
  box-shadow: 0 0 0 2px rgba(94, 234, 212, 0.12);
}

.weather-param-value i {
  color: #648691;
  font-size: 9px;
  font-style: normal;
}

.weather-range-wrap {
  position: relative;
  padding-top: 3px;
}

.weather-range-wrap input[type="range"] {
  width: 100%;
  height: 4px;
  margin: 0;
  accent-color: #5eead4;
  cursor: pointer;
}

.weather-optimal-marker {
  position: absolute;
  top: 0;
  z-index: 1;
  width: 2px;
  height: 10px;
  border-radius: 2px;
  background: #facc15;
  box-shadow: 0 0 7px rgba(250, 204, 21, 0.75);
  pointer-events: none;
  transform: translateX(-1px);
}

.custom-weather-panel .weather-btn.apply {
  width: 100%;
  flex: none;
  margin-top: 2px;
}

.scan-btn {
  width: 100%;
  border: none;
  background: linear-gradient(90deg, rgba(0, 229, 255, 0.2), rgba(47, 123, 255, 0.2));
  color: #e8f1ff;
  font-size: 13px;
  padding: 9px 0;
  border-radius: 8px;
  cursor: pointer;
  border: 1px solid rgba(0, 229, 255, 0.3);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.scan-btn:hover {
  background: linear-gradient(90deg, rgba(0, 229, 255, 0.32), rgba(47, 123, 255, 0.32));
}

/* —— 告警 —— */
.alert-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 84px;
  overflow-y: auto;
}

.alert-item {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}

.alert-dot {
  flex: 0 0 auto;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-top: 4px;
  background: #ff9f0a;
  box-shadow: 0 0 8px #ff9f0a;
  animation: blink 1.6s ease-in-out infinite;
}

.alert-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.alert-text {
  font-size: 12px;
  color: #cfeaff;
  line-height: 1.4;
}

.alert-time {
  font-size: 11px;
  color: #6f87a8;
}

/* —— 动画 —— */
@keyframes flow {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

@keyframes scan {
  0% {
    top: -2px;
  }
  100% {
    top: 100%;
  }
}

@keyframes blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.35;
  }
}

/* —— P2: 地块结构小字（合并到左侧卡片）—— */
.plot-structure-mini {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--border-subtle);
  color: #5c7a85;
  font-size: 11px;
  line-height: 1.5;
  letter-spacing: 0.02em;
}

/* —— P2: Drawer 入口按钮 —— */
.weather-head-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.drawer-open-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: 999px;
  border: 1px solid var(--border-subtle);
  background: transparent;
  color: #6e94a0;
  font: inherit;
  font-size: 10.5px;
  cursor: pointer;
  transition:
    border-color 0.2s var(--ease-smooth),
    color 0.2s var(--ease-smooth),
    background 0.2s var(--ease-smooth),
    box-shadow 0.2s var(--ease-smooth);
}
.drawer-open-btn:hover {
  border-color: var(--accent-cyan);
  color: var(--accent-cyan);
  background: rgba(34, 211, 238, 0.08);
}
.drawer-open-btn.active {
  border-color: var(--accent-cyan);
  color: var(--accent-cyan);
  background: rgba(34, 211, 238, 0.14);
  box-shadow: 0 0 10px rgba(34, 211, 238, 0.3);
}

/* —— P2/P3: Drawer 遮罩 + 面板（P3 改为从左侧滑出） —— */
.drawer-backdrop {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(0px);
}

.drawer-panel {
  position: fixed;
  top: 0;
  left: 0;                              /* P3: 左侧滑出 */
  z-index: 101;
  height: 100vh;
  width: 380px;
  max-width: 85vw;
  display: flex;
  flex-direction: column;
  background: var(--glass-bg-high);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  border-right: 1px solid var(--border-normal);  /* P3: 左边框改右边框 */
  box-shadow: 8px 0 32px rgba(0, 0, 0, 0.55);    /* P3: 阴影方向翻转 */
  overflow: hidden;
}

.weather-drawer .drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px;
  border-bottom: 1px solid var(--border-subtle);
  background: rgba(34, 211, 238, 0.06);
}
.drawer-title-group {
  display: flex;
  align-items: center;
  gap: 10px;
}
.drawer-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent-cyan);
  box-shadow: var(--shadow-glow-cyan);
}
.drawer-close {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: 1px solid var(--border-subtle);
  background: transparent;
  color: #6e94a0;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.18s var(--ease-smooth);
}
.drawer-close:hover {
  background: rgba(244, 63, 94, 0.15);
  border-color: var(--accent-rose);
  color: var(--accent-rose);
}

.weather-drawer .drawer-body {
  flex: 1;
  overflow-y: auto;
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.weather-drawer .drawer-body::-webkit-scrollbar {
  width: 6px;
}
.weather-drawer .drawer-body::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.12);
  border-radius: 3px;
}

.drawer-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.drawer-subtitle {
  margin: 0;
  font-size: 11px;
  font-weight: 600;
  color: #6e94a0;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}
.drawer-subtitle-sm {
  margin: 12px 0 6px;
  font-size: 10.5px;
  font-weight: 600;
  color: #5aa8b4;
}

.weather-drawer .drawer-footer {
  padding: 12px 20px 20px;
  border-top: 1px solid var(--border-subtle);
  display: flex;
  justify-content: center;
}
.weather-drawer .scan-btn {
  width: 100%;
  padding: 10px;
  border-radius: var(--radius-md);
  border: 1px solid rgba(52, 211, 153, 0.4);
  background: rgba(52, 211, 153, 0.12);
  color: #86efac;
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s var(--ease-smooth);
}
.weather-drawer .scan-btn:hover {
  background: rgba(52, 211, 153, 0.22);
  border-color: var(--accent-green);
  box-shadow: var(--shadow-glow-green);
}
.weather-drawer .weather-btn.apply {
  background: rgba(34, 211, 238, 0.18);
  border-color: var(--accent-cyan);
  color: var(--accent-cyan);
  align-self: flex-start;
}

/* Drawer transitions */
.drawer-fade-enter-active,
.drawer-fade-leave-active {
  transition: opacity 0.22s var(--ease-smooth);
}
.drawer-fade-enter-from,
.drawer-fade-leave-to {
  opacity: 0;
}

.drawer-slide-enter-active,
.drawer-slide-leave-active {
  transition:
    transform 0.28s var(--ease-smooth),
    opacity 0.28s var(--ease-smooth);
}
.drawer-slide-enter-from,
.drawer-slide-leave-to {
  transform: translateX(-100%);     /* P3: 从左侧滑出 → 向左平移 */
  opacity: 0;
}

/* —— P3: 折叠面板 Accordion Transition —— */
.accordion-enter-active,
.accordion-leave-active {
  transition:
    max-height 0.35s var(--ease-smooth),
    opacity 0.30s var(--ease-smooth),
    margin-top 0.30s var(--ease-smooth);
  overflow: hidden;
}
.accordion-enter-from,
.accordion-leave-to {
  max-height: 0;
  opacity: 0;
  margin-top: 0;
}

/* —— P2: 告警气泡列表（右侧面板顶部）—— */
.alarm-bubble-list {
  margin-bottom: 12px;
  padding: 10px 12px;
  border-radius: var(--radius-md);
  background: rgba(251, 191, 36, 0.08);
  border: 1px solid rgba(251, 191, 36, 0.35);
  max-height: none;
  overflow: visible;
}
.abl-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid rgba(251, 191, 36, 0.2);
}
.abl-pulse {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent-amber);
  box-shadow: 0 0 8px rgba(251, 191, 36, 0.5);
  animation: abl-pulse 1.2s ease-in-out infinite;
}
@keyframes abl-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.7); }
}
.abl-title {
  flex: 1;
  font-size: 11px;
  font-weight: 600;
  color: #fbbf24;
  letter-spacing: 0.08em;
}
.abl-count {
  padding: 1px 7px;
  border-radius: 10px;
  background: rgba(251, 191, 36, 0.2);
  color: #fcd34d;
  font-size: 10px;
  font-weight: 600;
}
.abl-body {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: none;
  overflow: visible;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.abl-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.18);
  border-left: 2px solid var(--accent-amber);
  animation: abl-slide-in 0.35s var(--ease-smooth);
  cursor: pointer;            /* P5: 可点击 */
  transition: background 0.18s, transform 0.18s;
}
.abl-item:hover {
  background: rgba(34, 211, 238, 0.14);
  transform: translateX(2px);
}
.abl-item:active { transform: translateX(0); }
.abl-item:focus-visible {
  outline: 1px solid var(--accent-cyan);
  outline-offset: -2px;
}
/* P5: 全图正常空状态 */
.abl-item.abl-all-clear {
  border-left-color: var(--accent-green);
  background: rgba(52, 211, 153, 0.1);
  cursor: default;
}
.abl-item.abl-all-clear:hover {
  background: rgba(52, 211, 153, 0.14);
  transform: none;
}
.abl-item.level-danger {
  border-left-color: var(--accent-rose);
  background: rgba(244, 63, 94, 0.1);
}
.abl-item.level-info {
  border-left-color: var(--accent-cyan);
  background: rgba(34, 211, 238, 0.06);
}

/* P5: 三色状态机 — 绑定在 .alarm-bubble-list 上 */
.alarm-bubble-list.status-healthy {
  border-color: rgba(52, 211, 153, 0.4);
  box-shadow: 0 0 12px rgba(52, 211, 153, 0.15), inset 0 0 10px rgba(52, 211, 153, 0.06);
}
.alarm-bubble-list.status-healthy .abl-title { color: var(--accent-green); }
.alarm-bubble-list.status-healthy .abl-pulse { background: var(--accent-green); box-shadow: 0 0 6px var(--accent-green); }
.alarm-bubble-list.status-healthy .abl-count { color: var(--accent-green); }

.alarm-bubble-list.status-warning {
  border-color: rgba(251, 191, 36, 0.55);
  box-shadow: 0 0 14px rgba(251, 191, 36, 0.25), inset 0 0 10px rgba(251, 191, 36, 0.08);
}
.alarm-bubble-list.status-warning .abl-title { color: var(--accent-amber); }
.alarm-bubble-list.status-warning .abl-pulse { background: var(--accent-amber); box-shadow: 0 0 8px var(--accent-amber); animation: abl-pulse-slow 2.4s ease-in-out infinite; }

.alarm-bubble-list.status-danger {
  border-color: rgba(244, 63, 94, 0.65);
  box-shadow: 0 0 18px rgba(244, 63, 94, 0.35), inset 0 0 14px rgba(244, 63, 94, 0.1);
  animation: abl-danger-breathe 1.8s ease-in-out infinite;
}
.alarm-bubble-list.status-danger .abl-title { color: var(--accent-rose); }
.alarm-bubble-list.status-danger .abl-pulse { background: var(--accent-rose); box-shadow: 0 0 10px var(--accent-rose); animation: abl-pulse-fast 0.9s ease-in-out infinite; }
.alarm-bubble-list.status-danger .abl-count { color: var(--accent-rose); }

@keyframes abl-pulse-slow { 0%,100% { opacity:.7; transform:scale(1) } 50% { opacity:1; transform:scale(1.2) } }
@keyframes abl-pulse-fast { 0%,100% { opacity:.6; transform:scale(1) } 50% { opacity:1; transform:scale(1.3) } }
@keyframes abl-danger-breathe {
  0%, 100% { box-shadow: 0 0 10px rgba(244, 63, 94, 0.25), inset 0 0 8px rgba(244, 63, 94, 0.06); }
  50%      { box-shadow: 0 0 24px rgba(244, 63, 94, 0.55), inset 0 0 16px rgba(244, 63, 94, 0.14); }
}
@keyframes abl-slide-in {
  from { opacity: 0; transform: translateX(-8px); }
  to { opacity: 1; transform: translateX(0); }
}
.abl-dot {
  flex-shrink: 0;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--accent-amber);
}
.abl-item.level-danger .abl-dot { background: var(--accent-rose); }
.abl-item.level-info .abl-dot { background: var(--accent-cyan); }
.abl-text {
  flex: 1;
  font-size: 11px;
  color: #e5e7eb;
  line-height: 1.4;
}
.abl-time {
  flex-shrink: 0;
  font-size: 10px;
  color: #8c9aa0;
}
/* P7: 聚合告警 —— 一条顶 N 条，右侧给个"高亮"提示 */
.abl-item.is-aggregate {
  border-left-width: 3px;
  background: rgba(251, 191, 36, 0.1);
}
.abl-item.is-aggregate.level-danger {
  background: rgba(244, 63, 94, 0.14);
}
.abl-tag {
  flex-shrink: 0;
  padding: 1px 6px;
  border-radius: 8px;
  font-size: 9px;
  line-height: 14px;
  color: #fcd34d;
  background: rgba(251, 191, 36, 0.16);
  border: 1px solid rgba(251, 191, 36, 0.32);
}
.abl-item.level-danger .abl-tag {
  color: #fda4af;
  background: rgba(244, 63, 94, 0.16);
  border-color: rgba(244, 63, 94, 0.32);
}

/* —— P3: 组件详情卡 Component Inspector Card —— */
.component-inspector-card {
  margin-top: 12px;
  padding: 14px;
  border-radius: var(--radius-md);
  background: rgba(0, 0, 0, 0.20);
  border: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* 头部：大图标 + 名称 + Toggle */
.cic-head {
  display: flex;
  align-items: center;
  gap: 12px;
}
.cic-icon {
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(34, 211, 238, 0.12);
  border: 1px solid rgba(34, 211, 238, 0.35);
  box-shadow: 0 0 16px rgba(34, 211, 238, 0.2);
  color: var(--accent-cyan);
}
.cic-icon svg {
  width: 22px;
  height: 22px;
  stroke: currentColor;
}
.cic-icon.ventilation { background: rgba(52, 211, 153, 0.12); border-color: rgba(52, 211, 153, 0.35); color: var(--accent-green); box-shadow: 0 0 16px rgba(52, 211, 153, 0.2); }
.cic-icon.co2Supply { background: rgba(99, 102, 241, 0.12); border-color: rgba(99, 102, 241, 0.35); color: #818cf8; box-shadow: 0 0 16px rgba(99, 102, 241, 0.2); }
.cic-icon.camera { background: rgba(251, 191, 36, 0.12); border-color: rgba(251, 191, 36, 0.35); color: var(--accent-amber); box-shadow: 0 0 16px rgba(251, 191, 36, 0.2); }
/* P4: 杀虫灯 + 遮阳网 icon 颜色 */
.cic-icon.pestLamp { background: rgba(236, 72, 153, 0.12); border-color: rgba(236, 72, 153, 0.35); color: #f472b6; box-shadow: 0 0 16px rgba(236, 72, 153, 0.2); }
.cic-icon.sunshade { background: rgba(249, 115, 22, 0.12); border-color: rgba(249, 115, 22, 0.35); color: #fb923c; box-shadow: 0 0 16px rgba(249, 115, 22, 0.2); }
.cic-icon.heater { background: rgba(239, 68, 68, 0.14); border-color: rgba(239, 68, 68, 0.4); color: #f87171; box-shadow: 0 0 16px rgba(239, 68, 68, 0.22); }
.cic-icon.irrigationStation { background: rgba(56, 189, 248, 0.14); border-color: rgba(56, 189, 248, 0.42); color: #7dd3fc; box-shadow: 0 0 16px rgba(56, 189, 248, 0.24); }
.cic-icon.humidifier,
.cic-icon.humidifierStation {
  background: rgba(125, 211, 252, 0.14);
  border-color: rgba(125, 211, 252, 0.4);
  color: #bae6fd;
  box-shadow: 0 0 16px rgba(125, 211, 252, 0.22);
}
.cic-icon.dehumidifier,
.cic-icon.dehumidifierStation {
  background: rgba(45, 212, 191, 0.12);
  border-color: rgba(45, 212, 191, 0.38);
  color: #7dd3c8;
  box-shadow: 0 0 16px rgba(45, 212, 191, 0.2);
}
.cic-icon.growLight,
.cic-icon.growLightStation {
  background: rgba(250, 204, 21, 0.14);
  border-color: rgba(250, 204, 21, 0.42);
  color: #fde68a;
  box-shadow: 0 0 16px rgba(250, 204, 21, 0.24);
}

.cic-meta {
  flex: 1;
  min-width: 0;
}
.cic-name {
  font-size: 14px;
  font-weight: 600;
  color: #f1f5f9;
  line-height: 1.2;
}
.cic-location {
  margin-top: 2px;
  font-size: 11px;
  color: #6e94a0;
}
.cic-location strong {
  color: #c8dbe2;
  font-weight: 600;
}
.cic-control-mode {
  margin-top: 4px;
  color: #7dd3fc;
  font-size: 9.5px;
  line-height: 1.4;
}

/* 发光 Toggle 开关 */
.cic-toggle {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0;
}
.cic-toggle-track {
  position: relative;
  display: inline-block;
  width: 40px;
  height: 22px;
  border-radius: 11px;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.15);
  transition: background 0.25s var(--ease-smooth), border-color 0.25s var(--ease-smooth), box-shadow 0.25s var(--ease-smooth);
}
.cic-toggle-track::after {
  content: "";
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #cbd5e1;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
  transition: transform 0.25s var(--ease-smooth), background 0.25s var(--ease-smooth), box-shadow 0.25s var(--ease-smooth);
}
.cic-toggle-label {
  font-size: 10px;
  font-weight: 600;
  color: #6e94a0;
  letter-spacing: 0.06em;
  transition: color 0.25s var(--ease-smooth);
}
.cic-toggle.on .cic-toggle-track {
  background: rgba(52, 211, 153, 0.30);
  border-color: var(--accent-green);
  box-shadow: 0 0 10px rgba(52, 211, 153, 0.4);
}
.cic-toggle.on .cic-toggle-track::after {
  transform: translateX(18px);
  background: var(--accent-green);
  box-shadow: 0 0 8px rgba(52, 211, 153, 0.7);
}
.cic-toggle.on .cic-toggle-label {
  color: var(--accent-green);
}

/* 影响区 */
.cic-effects {
  margin-top: 2px;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--border-subtle);
}
.cic-effects-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 11px;
  font-weight: 600;
  color: #6e94a0;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.cic-effect-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.cic-effect-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
}
.cic-effect-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--accent-cyan);
  flex-shrink: 0;
}
.cic-effect-dot.up { background: var(--accent-green); }
.cic-effect-dot.down { background: var(--accent-rose); }
.cic-effect-dot.neutral { background: #64748b; }
.cic-effect-label {
  flex: 1;
  color: #a0b4bd;
}
.cic-effect-val {
  font-size: 10.5px;
  font-family: "JetBrains Mono", "Consolas", monospace;
  color: var(--accent-cyan);
  font-weight: 500;
}
.cic-effect-empty {
  font-size: 10.5px;
  color: #5c7a85;
  font-style: italic;
}

/* 底部移除按钮 */
.cic-footer {
  margin-top: 2px;
}
.cic-footer .component-remove-btn {
  width: 100%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid rgba(244, 63, 94, 0.4);
  background: rgba(244, 63, 94, 0.10);
  color: #fda4b5;
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s var(--ease-smooth);
}
.cic-footer .component-remove-btn:hover {
  background: rgba(244, 63, 94, 0.22);
  border-color: var(--accent-rose);
  color: var(--accent-rose);
  box-shadow: 0 0 14px rgba(244, 63, 94, 0.25);
}

/* —— P3 Part 2: 2x2 环形仪表盘网格 —— */
.gauge-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin: 8px 0 12px;
}

/* —— P3 Part 3: 光照/CO2 横向卡片 —— */
.env-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 14px;
}
.env-card {
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.18);
  border: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
  gap: 6px;
  transition: border-color 0.25s var(--ease-smooth), box-shadow 0.25s var(--ease-smooth);
}
.env-card.light { border-color: rgba(251, 191, 36, 0.25); }
.env-card.co2   { border-color: rgba(99, 102, 241, 0.25); }
.env-card.is-warning {
  border-color: rgba(251, 191, 36, 0.58);
  background: rgba(251, 191, 36, 0.08);
  box-shadow: 0 0 12px rgba(251, 191, 36, 0.12);
}
.env-card.is-danger {
  border-color: rgba(244, 63, 94, 0.68);
  background: rgba(244, 63, 94, 0.1);
  box-shadow: 0 0 14px rgba(244, 63, 94, 0.16);
}

.env-head {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10.5px;
  color: #8aa0aa;
  font-weight: 600;
  letter-spacing: 0.04em;
}
.env-icon { font-size: 12px; }
.env-val-row {
  display: flex;
  align-items: baseline;
  gap: 4px;
}
.env-val-row .transition-num {
  font-size: 18px;
  font-weight: 600;
  font-family: "JetBrains Mono", "Consolas", monospace;
}
.env-card.light .env-val-row .transition-num { color: #fbbf24; }
.env-card.co2   .env-val-row .transition-num { color: #818cf8; }
.env-unit {
  font-size: 10px;
  color: #6e94a0;
  font-weight: 500;
}
.env-bar {
  height: 3px;
  background: rgba(255, 255, 255, 0.07);
  border-radius: 2px;
  overflow: hidden;
}
.env-bar-fill {
  display: block;
  height: 100%;
  border-radius: 2px;
  transition: width 0.8s ease-out;
}
.env-card.light .env-bar-fill { background: linear-gradient(90deg, rgba(251, 191, 36, 0.5), #fbbf24); box-shadow: 0 0 8px rgba(251, 191, 36, 0.4); }
.env-card.co2   .env-bar-fill { background: linear-gradient(90deg, rgba(99, 102, 241, 0.5), #818cf8); box-shadow: 0 0 8px rgba(99, 102, 241, 0.4); }
.env-hint {
  margin: 0;
  color: #9a8f73;
  font-size: 9px;
  line-height: 1.4;
}
.env-card.is-warning .env-hint { color: #d8b45e; }
.env-card.is-danger .env-hint { color: #f3a0ad; }

.num-inline {
  font-family: "JetBrains Mono", "Consolas", monospace;
  font-variant-numeric: tabular-nums;
}

/* —— P3 Part 2: 土壤剖面含水动画 —— */
.soil-profile .sp-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.sp-hint {
  font-size: 10.5px;
  color: #22d3ee;
  font-weight: 600;
  padding: 1px 8px;
  border-radius: 8px;
  background: rgba(34, 211, 238, 0.12);
  animation: hint-blink 1.4s ease-in-out infinite;
}
@keyframes hint-blink {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.55; }
}

.sp-layer {
  position: relative;
  overflow: hidden;
  border-bottom: 1px solid rgba(0, 0, 0, 0.18);
}

/* 水滴粒子：从顶部落下，opacity 递减 */
.wet-droplet {
  position: absolute;
  top: -6px;
  left: 50%;
  width: 4px;
  height: 6px;
  border-radius: 50%;
  background: radial-gradient(ellipse at 50% 30%, rgba(173, 216, 230, 0.9), rgba(100, 180, 220, 0.4));
  animation: drop-fall 1.8s ease-in infinite;
  pointer-events: none;
}
.wet-droplet.delay-1 { left: 30%; animation-delay: 0.5s; animation-duration: 2.2s; }
.wet-droplet.delay-2 { left: 70%; animation-delay: 1.0s; animation-duration: 1.6s; }
@keyframes drop-fall {
  0%   { transform: translateY(-6px);  opacity: 0; }
  15%  { opacity: 1; }
  85%  { opacity: 0.8; }
  100% { transform: translateY(100%); opacity: 0; }
}

/* 湿度热力条：绝对定位在层底部，宽度 = moisture% */
.wet-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  height: 3px;
  background: linear-gradient(90deg, rgba(34, 211, 238, 0.7), rgba(52, 211, 153, 0.6));
  border-radius: 2px;
  transition: width 0.8s ease-out;
  box-shadow: 0 0 6px rgba(34, 211, 238, 0.5);
}

/* 土壤剖面在含水时整体色调微微加深 */
.sp-stack.is-wetting .sp-layer {
  filter: saturate(1.05) brightness(1.02);
}
</style>
