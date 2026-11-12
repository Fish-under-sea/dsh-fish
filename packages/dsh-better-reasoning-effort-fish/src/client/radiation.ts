/** 品牌配色辐射特效，移植自 HanaAyane/dsh-reasoning-effort PR 9（MIT）。 */
import type { ModelThemeKind } from './model-theme.js'

export interface RadiationState {
  progress: number
  dragging: boolean
}

export function drawRadiation(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number,
  state: RadiationState,
  theme: ModelThemeKind = 'deepseek',
): void {
  const origin = state.progress * width
  const isDark = document.body.hasAttribute('data-ds-dark-theme')
  const cell = 4
  const speed = state.dragging ? 2.8 : 1

  context.clearRect(0, 0, width, height)
  if (origin <= 0) return

  context.save()
  context.beginPath()
  context.rect(0, 0, origin, height)
  context.clip()

  for (let x = 0; x < origin; x += cell) {
    const delta = x + cell * 0.5 - origin
    const distance = Math.abs(delta)
    const phaseA = distance / 10 - time * 0.0074 * speed
    const phaseB = distance / 23 - time * 0.0041 * speed + 1.7
    const phaseC = distance / 40 - time * 0.0022 * speed + 3.4
    const sinA = Math.max(0, Math.sin(phaseA))
    const sinB = Math.max(0, Math.sin(phaseB))
    const sinC = Math.max(0, Math.sin(phaseC))
    const waveA = Math.pow(sinA, 2.6)
    const waveB = Math.pow(sinB, 3.2)
    const waveC = Math.pow(sinC, 4)
    const crest = Math.pow(sinA, 15) + Math.pow(sinB, 18) * 0.78
    const wave = Math.min(1, waveA * 0.76 + waveB * 0.58 + waveC * 0.32)
    const trail = 0.38 + 0.62 * Math.exp(-distance / Math.max(55, width * 0.72))
    const pillar = Math.pow(Math.max(0, Math.sin(x / 20 + time * 0.0016)), 3) * 0.27
    const columnEnergy = trail * (wave * 1.04 + pillar + crest * 0.32)

    if (columnEnergy > 0.012) {
      const nearness = Math.max(0, 1 - distance / Math.max(1, width * 0.78))
      let red: number
      let green: number
      let blue: number
      if (theme === 'gemini') {
        // Multi-color Google Gemini Spectrum: Amber -> Emerald -> Blue -> Violet/Indigo -> Coral Pink
        const posRatio = Math.min(1, Math.max(0, x / Math.max(1, origin)))
        if (posRatio < 0.25) {
          // Amber to Green
          const t = posRatio / 0.25
          red = isDark ? Math.round(210 * (1 - t) + 15 * t + 30 * wave) : Math.round(230 * (1 - t) + 20 * t + 20 * wave)
          green = isDark ? Math.round(140 * (1 - t) + 180 * t + 40 * crest) : Math.round(160 * (1 - t) + 190 * t + 30 * crest)
          blue = isDark ? Math.round(15 * (1 - t) + 100 * t) : Math.round(20 * (1 - t) + 110 * t)
        } else if (posRatio < 0.55) {
          // Green to Blue
          const t = (posRatio - 0.25) / 0.3
          red = isDark ? Math.round(15 * (1 - t) + 50 * t + 35 * wave) : Math.round(20 * (1 - t) + 60 * t + 20 * wave)
          green = isDark ? Math.round(180 * (1 - t) + 120 * t + 35 * crest) : Math.round(190 * (1 - t) + 135 * t + 25 * crest)
          blue = isDark ? Math.round(100 * (1 - t) + 245 * t) : Math.round(110 * (1 - t) + 250 * t)
        } else if (posRatio < 0.82) {
          // Blue to Royal Violet
          const t = (posRatio - 0.55) / 0.27
          red = isDark ? Math.round(50 * (1 - t) + 140 * t + 45 * wave) : Math.round(60 * (1 - t) + 145 * t + 20 * wave)
          green = isDark ? Math.round(120 * (1 - t) + 45 * t + 25 * crest) : Math.round(135 * (1 - t) + 65 * t + 20 * crest)
          blue = isDark ? Math.round(245 * (1 - t) + 235 * t) : Math.round(250 * (1 - t) + 240 * t)
        } else {
          // Violet to Coral Pink
          const t = (posRatio - 0.82) / 0.18
          red = isDark ? Math.round(140 * (1 - t) + 235 * t + 20 * wave) : Math.round(145 * (1 - t) + 240 * t + 15 * wave)
          green = isDark ? Math.round(45 * (1 - t) + 55 * t + 20 * crest) : Math.round(65 * (1 - t) + 70 * t + 15 * crest)
          blue = isDark ? Math.round(235 * (1 - t) + 110 * t) : Math.round(240 * (1 - t) + 125 * t)
        }
      } else if (theme === 'claude') {
        red = isDark
          ? Math.round(180 + 70 * nearness + 35 * wave)
          : Math.round(195 + 55 * nearness + 15 * wave)
        green = isDark
          ? Math.round(55 + 95 * nearness + 45 * wave)
          : Math.round(90 + 75 * nearness + 20 * wave)
        blue = isDark
          ? Math.round(15 + 35 * nearness + 10 * wave)
          : Math.round(25 + 40 * nearness)
      } else if (theme === 'kimi') {
        const posRatio = Math.min(1, Math.max(0, x / Math.max(1, origin)))
        if (posRatio < 0.75) {
          const t = posRatio / 0.75
          red = isDark ? Math.round(25 * (1 - t) + 85 * t + 35 * wave) : Math.round(20 * (1 - t) + 75 * t + 20 * wave)
          green = isDark ? Math.round(35 * (1 - t) + 115 * t + 35 * wave) : Math.round(30 * (1 - t) + 105 * t + 20 * wave)
          blue = isDark ? Math.round(90 * (1 - t) + 235 * t + 15 * wave) : Math.round(85 * (1 - t) + 225 * t + 10 * wave)
        } else {
          const t = (posRatio - 0.75) / 0.25
          red = isDark ? Math.round(85 * (1 - t) + 250 * t + 40 * crest) : Math.round(75 * (1 - t) + 245 * t + 30 * crest)
          green = isDark ? Math.round(115 * (1 - t) + 215 * t + 30 * crest) : Math.round(105 * (1 - t) + 205 * t + 25 * crest)
          blue = isDark ? Math.round(235 * (1 - t) + 110 * t) : Math.round(225 * (1 - t) + 100 * t)
        }
      } else if (theme === 'glm') {
        const posRatio = Math.min(1, Math.max(0, x / Math.max(1, origin)))
        if (posRatio < 0.7) {
          const t = posRatio / 0.7
          red = isDark ? Math.round(15 * (1 - t) + 35 * t + 20 * wave) : Math.round(10 * (1 - t) + 30 * t + 15 * wave)
          green = isDark ? Math.round(30 * (1 - t) + 95 * t + 35 * wave) : Math.round(25 * (1 - t) + 85 * t + 20 * wave)
          blue = isDark ? Math.round(60 * (1 - t) + 185 * t + 25 * wave) : Math.round(50 * (1 - t) + 175 * t + 15 * wave)
        } else {
          const t = (posRatio - 0.7) / 0.3
          red = isDark ? Math.round(35 * (1 - t) + 56 * t + 35 * wave) : Math.round(30 * (1 - t) + 50 * t + 20 * wave)
          green = isDark ? Math.round(95 * (1 - t) + 189 * t + 40 * crest) : Math.round(85 * (1 - t) + 175 * t + 30 * crest)
          blue = isDark ? Math.round(185 * (1 - t) + 248 * t + 10 * wave) : Math.round(175 * (1 - t) + 240 * t)
        }
      } else if (theme === 'qwen') {
        const posRatio = Math.min(1, Math.max(0, x / Math.max(1, origin)))
        if (posRatio < 0.75) {
          const t = posRatio / 0.75
          red = isDark ? Math.round(20 * (1 - t) + 80 * t + 25 * wave) : Math.round(15 * (1 - t) + 65 * t + 15 * wave)
          green = isDark ? Math.round(40 * (1 - t) + 145 * t + 35 * wave) : Math.round(35 * (1 - t) + 130 * t + 20 * wave)
          blue = isDark ? Math.round(110 * (1 - t) + 248 * t + 15 * wave) : Math.round(100 * (1 - t) + 240 * t + 10 * wave)
        } else {
          const t = (posRatio - 0.75) / 0.25
          red = isDark ? Math.round(80 * (1 - t) + 251 * t + 35 * crest) : Math.round(65 * (1 - t) + 246 * t + 25 * crest)
          green = isDark ? Math.round(145 * (1 - t) + 191 * t + 30 * crest) : Math.round(130 * (1 - t) + 200 * t + 25 * crest)
          blue = isDark ? Math.round(248 * (1 - t) + 36 * t) : Math.round(240 * (1 - t) + 69 * t)
        }
      } else if (theme === 'minimax') {
        const posRatio = Math.min(1, Math.max(0, x / Math.max(1, origin)))
        if (posRatio < 0.65) {
          const t = posRatio / 0.65
          red = isDark ? Math.round(110 * (1 - t) + 240 * t + 25 * wave) : Math.round(130 * (1 - t) + 245 * t + 15 * wave)
          green = isDark ? Math.round(30 * (1 - t) + 75 * t + 25 * wave) : Math.round(40 * (1 - t) + 85 * t + 15 * wave)
          blue = isDark ? Math.round(25 * (1 - t) + 60 * t + 10 * wave) : Math.round(35 * (1 - t) + 65 * t + 10 * wave)
        } else {
          const t = (posRatio - 0.65) / 0.35
          red = 255
          green = isDark ? Math.round(75 * (1 - t) + 130 * t + 35 * crest) : Math.round(85 * (1 - t) + 140 * t + 25 * crest)
          blue = isDark ? Math.round(60 * (1 - t) + 90 * t + 15 * crest) : Math.round(65 * (1 - t) + 95 * t + 10 * crest)
        }
      } else if (theme === 'openai') {
        red = isDark
          ? Math.round(95 + 120 * nearness + 65 * wave)
          : Math.round(110 + 60 * nearness + 20 * wave)
        green = isDark
          ? Math.round(28 + 42 * nearness + 28 * crest)
          : Math.round(55 + 50 * nearness + 25 * crest)
        blue = isDark
          ? Math.round(195 + 58 * nearness + 10 * wave)
          : Math.round(215 + 40 * nearness)
      } else {
        red = isDark
          ? Math.round(42 + 124 * nearness + 75 * wave)
          : Math.round(28 + 58 * nearness + 15 * wave)
        green = isDark
          ? Math.round(56 + 58 * nearness + 44 * crest)
          : Math.round(88 + 72 * nearness + 30 * crest)
        blue = isDark
          ? Math.round(175 + 72 * nearness + 8 * wave)
          : Math.round(182 + 62 * nearness)
      }
      const alpha = isDark
        ? Math.min(0.88, columnEnergy * 0.72)
        : Math.min(0.62, columnEnergy * 0.54)
      context.fillStyle = `rgba(${red}, ${green}, ${blue}, ${alpha})`
      context.fillRect(x, 0, cell - 1, height)
    }

    for (let y = 0; y < height; y += cell) {
      const deltaY = y + cell * 0.5 - height * 0.5
      const radial = Math.hypot(delta / 38, deltaY / 11)
      const halo = Math.exp(-radial * 0.96) * 1.08
      const verticalShape = 0.58 + 0.42 * Math.cos((deltaY / height) * Math.PI)
      const grain = 0.72 + 0.28 * Math.sin(x * 0.73 + y * 1.31 + time * 0.006)
      const alpha = Math.min(0.96, (columnEnergy * 0.88 + halo + crest * 0.19) * verticalShape * grain)
      if (alpha < 0.035) continue

      const hot = Math.max(0, 1 - radial / 2.4)
      let red: number
      let green: number
      let blue: number
      if (theme === 'gemini') {
        const posRatio = Math.min(1, Math.max(0, x / Math.max(1, origin)))
        if (posRatio < 0.5) {
          red = isDark ? Math.round(80 + 110 * hot + 40 * wave) : Math.round(90 + 70 * hot + 20 * wave)
          green = isDark ? Math.round(120 + 70 * hot + 30 * crest) : Math.round(140 + 60 * hot + 20 * crest)
          blue = isDark ? Math.round(160 + 80 * hot) : Math.round(175 + 70 * hot)
        } else {
          red = isDark ? Math.round(140 + 105 * hot + 30 * wave) : Math.round(150 + 65 * hot + 15 * wave)
          green = isDark ? Math.round(50 + 60 * hot + 25 * crest) : Math.round(75 + 50 * hot + 20 * crest)
          blue = isDark ? Math.round(210 + 40 * hot) : Math.round(220 + 30 * hot)
        }
      } else if (theme === 'claude') {
        red = isDark
          ? Math.round(200 + 55 * hot + 25 * wave + 25 * crest)
          : Math.round(210 + 45 * hot + 15 * wave)
        green = isDark
          ? Math.round(75 + 115 * hot + 35 * crest)
          : Math.round(105 + 85 * hot + 25 * crest)
        blue = isDark
          ? Math.round(20 + 40 * hot)
          : Math.round(30 + 35 * hot)
      } else if (theme === 'kimi') {
        const posRatio = Math.min(1, Math.max(0, x / Math.max(1, origin)))
        if (posRatio < 0.65) {
          red = isDark ? Math.round(40 + 80 * hot + 25 * wave) : Math.round(35 + 65 * hot + 15 * wave)
          green = isDark ? Math.round(60 + 95 * hot + 30 * crest) : Math.round(65 + 85 * hot + 20 * crest)
          blue = isDark ? Math.round(175 + 75 * hot) : Math.round(185 + 65 * hot)
        } else {
          red = isDark ? Math.round(120 + 130 * hot + 35 * wave) : Math.round(110 + 125 * hot + 20 * wave)
          green = isDark ? Math.round(110 + 115 * hot + 35 * crest) : Math.round(120 + 95 * hot + 20 * crest)
          blue = isDark ? Math.round(160 + 50 * hot) : Math.round(170 + 40 * hot)
        }
      } else if (theme === 'glm') {
        const posRatio = Math.min(1, Math.max(0, x / Math.max(1, origin)))
        if (posRatio < 0.65) {
          red = isDark ? Math.round(25 + 50 * hot + 20 * wave) : Math.round(20 + 40 * hot + 10 * wave)
          green = isDark ? Math.round(55 + 85 * hot + 30 * crest) : Math.round(50 + 75 * hot + 20 * crest)
          blue = isDark ? Math.round(110 + 95 * hot) : Math.round(115 + 85 * hot)
        } else {
          red = isDark ? Math.round(45 + 110 * hot + 25 * wave) : Math.round(40 + 95 * hot + 15 * wave)
          green = isDark ? Math.round(110 + 120 * hot + 35 * crest) : Math.round(100 + 105 * hot + 25 * crest)
          blue = isDark ? Math.round(195 + 55 * hot) : Math.round(190 + 50 * hot)
        }
      } else if (theme === 'qwen') {
        const posRatio = Math.min(1, Math.max(0, x / Math.max(1, origin)))
        if (posRatio < 0.65) {
          red = isDark ? Math.round(35 + 75 * hot + 20 * wave) : Math.round(30 + 55 * hot + 15 * wave)
          green = isDark ? Math.round(75 + 115 * hot + 30 * crest) : Math.round(70 + 95 * hot + 20 * crest)
          blue = isDark ? Math.round(190 + 65 * hot) : Math.round(195 + 55 * hot)
        } else {
          red = isDark ? Math.round(110 + 141 * hot + 30 * wave) : Math.round(100 + 135 * hot + 20 * wave)
          green = isDark ? Math.round(120 + 105 * hot + 35 * crest) : Math.round(110 + 95 * hot + 20 * crest)
          blue = isDark ? Math.round(180 + 40 * hot) : Math.round(185 + 30 * hot)
        }
      } else if (theme === 'minimax') {
        red = 255
        green = isDark
          ? Math.round(75 + 85 * hot + 30 * crest)
          : Math.round(95 + 75 * hot + 20 * crest)
        blue = isDark
          ? Math.round(65 + 50 * hot)
          : Math.round(80 + 40 * hot)
      } else if (theme === 'openai') {
        red = isDark
          ? Math.round(120 + 135 * hot + 40 * wave + 30 * crest)
          : Math.round(125 + 65 * hot + 15 * wave)
        green = isDark
          ? Math.round(38 + 58 * hot + 32 * crest)
          : Math.round(65 + 55 * hot + 20 * crest)
        blue = isDark
          ? Math.round(205 + 50 * hot)
          : Math.round(225 + 30 * hot)
      } else {
        red = isDark
          ? Math.round(54 + 148 * hot + 42 * wave + 35 * crest)
          : Math.round(25 + 72 * hot + 12 * wave)
        green = isDark
          ? Math.round(68 + 78 * hot + 46 * crest)
          : Math.round(98 + 72 * hot + 24 * crest)
        blue = isDark
          ? Math.round(186 + 64 * hot)
          : Math.round(194 + 56 * hot)
      }
      context.fillStyle = `rgba(${red}, ${green}, ${blue}, ${isDark ? alpha : alpha * 0.72})`
      context.fillRect(x, y, cell - 1, cell - 1)
    }
  }

  for (let i = 0; i < 14; i += 1) {
    const travel = (time * (state.dragging ? 0.16 : 0.065) * (0.78 + (i % 5) * 0.09) + i * 23) % Math.max(30, origin + 64)
    const particleX = origin - travel
    if (particleX < -24 || particleX > width + 16) continue
    const particleY = 3 + ((i * 13 + Math.sin(time * 0.003 + i) * 5) % Math.max(7, height - 6))
    const length = 4 + (i % 4) * 4 + (state.dragging ? 6 : 0)
    const alpha = 0.28 + (i % 5) * 0.1
    const streak = context.createLinearGradient(particleX, 0, particleX + length, 0)
    if (theme === 'gemini') {
      const colors = [
        isDark ? 'rgba(245,158,11,' : 'rgba(220,135,10,',  // Amber
        isDark ? 'rgba(16,185,129,' : 'rgba(12,155,105,',  // Emerald
        isDark ? 'rgba(66,133,244,' : 'rgba(50,110,225,',  // Google Blue
        isDark ? 'rgba(147,51,234,' : 'rgba(125,40,205,',  // Nebula Indigo
        isDark ? 'rgba(235,68,90,'  : 'rgba(215,50,75,',   // Coral Pink
      ]
      const c = colors[i % colors.length]
      streak.addColorStop(0, `${c}0)`)
      streak.addColorStop(0.68, `${c}${alpha})`)
      streak.addColorStop(1, isDark ? `rgba(255,255,255,${Math.min(1, alpha + 0.3)})` : `rgba(255,240,245,${Math.min(0.88, alpha + 0.2)})`)
    } else if (theme === 'claude') {
      streak.addColorStop(0, isDark ? 'rgba(255,95,20,0)' : 'rgba(230,80,15,0)')
      streak.addColorStop(0.68, isDark ? `rgba(255,140,50,${alpha})` : `rgba(245,125,40,${alpha * 0.75})`)
      streak.addColorStop(1, isDark ? `rgba(255,240,210,${Math.min(1, alpha + 0.3)})` : `rgba(255,210,160,${Math.min(0.88, alpha + 0.2)})`)
    } else if (theme === 'kimi') {
      if (i % 4 === 0) {
        // Golden star particle streak
        streak.addColorStop(0, isDark ? 'rgba(255,215,100,0)' : 'rgba(240,185,60,0)')
        streak.addColorStop(0.65, isDark ? `rgba(255,225,140,${alpha})` : `rgba(245,195,75,${alpha * 0.75})`)
        streak.addColorStop(1, isDark ? `rgba(255,255,255,${Math.min(1, alpha + 0.3)})` : `rgba(255,245,210,${Math.min(0.9, alpha + 0.2)})`)
      } else {
        // Midnight celestial indigo streak
        streak.addColorStop(0, isDark ? 'rgba(50,70,180,0)' : 'rgba(35,50,150,0)')
        streak.addColorStop(0.68, isDark ? `rgba(100,135,245,${alpha})` : `rgba(75,105,215,${alpha * 0.72})`)
        streak.addColorStop(1, isDark ? `rgba(225,235,255,${Math.min(1, alpha + 0.28)})` : `rgba(200,215,255,${Math.min(0.85, alpha + 0.2)})`)
      }
    } else if (theme === 'glm') {
      if (i % 3 === 0) {
        // Starlight cyan streak
        streak.addColorStop(0, isDark ? 'rgba(34,211,238,0)' : 'rgba(14,165,233,0)')
        streak.addColorStop(0.65, isDark ? `rgba(56,189,248,${alpha})` : `rgba(14,165,233,${alpha * 0.75})`)
        streak.addColorStop(1, isDark ? `rgba(224,242,254,${Math.min(1, alpha + 0.3)})` : `rgba(200,235,255,${Math.min(0.9, alpha + 0.2)})`)
      } else {
        // Deep obsidian slate-blue streak
        streak.addColorStop(0, isDark ? 'rgba(15,35,65,0)' : 'rgba(10,25,50,0)')
        streak.addColorStop(0.68, isDark ? `rgba(30,65,110,${alpha})` : `rgba(20,50,95,${alpha * 0.72})`)
        streak.addColorStop(1, isDark ? `rgba(186,230,253,${Math.min(1, alpha + 0.28)})` : `rgba(140,200,250,${Math.min(0.85, alpha + 0.2)})`)
      }
    } else if (theme === 'qwen') {
      if (i % 4 === 0) {
        // Starlight gold particle streak
        streak.addColorStop(0, isDark ? 'rgba(251,191,36,0)' : 'rgba(245,158,11,0)')
        streak.addColorStop(0.65, isDark ? `rgba(253,230,138,${alpha})` : `rgba(251,191,36,${alpha * 0.75})`)
        streak.addColorStop(1, isDark ? `rgba(255,255,255,${Math.min(1, alpha + 0.3)})` : `rgba(255,250,220,${Math.min(0.9, alpha + 0.2)})`)
      } else {
        // Ethereal azure sky blue streak
        streak.addColorStop(0, isDark ? 'rgba(37,99,235,0)' : 'rgba(29,78,216,0)')
        streak.addColorStop(0.68, isDark ? `rgba(96,165,250,${alpha})` : `rgba(59,130,246,${alpha * 0.72})`)
        streak.addColorStop(1, isDark ? `rgba(219,234,254,${Math.min(1, alpha + 0.28)})` : `rgba(191,219,254,${Math.min(0.85, alpha + 0.2)})`)
      }
    } else if (theme === 'minimax') {
      if (i % 3 === 0) {
        // Vibrant Sunset Coral Orange streak
        streak.addColorStop(0, isDark ? 'rgba(255,115,70,0)' : 'rgba(255,90,50,0)')
        streak.addColorStop(0.65, isDark ? `rgba(255,145,100,${alpha})` : `rgba(255,115,70,${alpha * 0.75})`)
        streak.addColorStop(1, isDark ? `rgba(255,245,240,${Math.min(1, alpha + 0.3)})` : `rgba(255,235,225,${Math.min(0.9, alpha + 0.2)})`)
      } else {
        // Bright Sunset Peach streak
        streak.addColorStop(0, isDark ? 'rgba(255,80,60,0)' : 'rgba(240,65,45,0)')
        streak.addColorStop(0.68, isDark ? `rgba(255,110,90,${alpha})` : `rgba(245,85,65,${alpha * 0.72})`)
        streak.addColorStop(1, isDark ? `rgba(255,225,210,${Math.min(1, alpha + 0.28)})` : `rgba(255,200,180,${Math.min(0.85, alpha + 0.2)})`)
      }
    } else if (theme === 'openai') {
      streak.addColorStop(0, isDark ? 'rgba(130,50,255,0)' : 'rgba(120,40,210,0)')
      streak.addColorStop(0.68, isDark ? `rgba(175,95,255,${alpha})` : `rgba(165,80,245,${alpha * 0.72})`)
      streak.addColorStop(1, isDark ? `rgba(255,230,255,${Math.min(1, alpha + 0.28)})` : `rgba(220,165,255,${Math.min(0.85, alpha + 0.2)})`)
    } else {
      streak.addColorStop(0, isDark ? 'rgba(72,118,255,0)' : 'rgba(24,94,184,0)')
      streak.addColorStop(0.68, isDark ? `rgba(112,135,255,${alpha})` : `rgba(36,108,202,${alpha * 0.72})`)
      streak.addColorStop(1, isDark ? `rgba(236,222,255,${Math.min(1, alpha + 0.26)})` : `rgba(103,175,248,${Math.min(0.82, alpha + 0.18)})`)
    }
    context.fillStyle = streak
    context.fillRect(particleX, particleY, length, i % 3 === 0 ? 2 : 1)
  }

  const glow = context.createRadialGradient(origin, height / 2, 0, origin, height / 2, 24)
  if (theme === 'gemini') {
    glow.addColorStop(0, isDark ? 'rgba(255,255,255,.96)' : 'rgba(255,255,255,.96)')
    glow.addColorStop(0.14, isDark ? 'rgba(230,215,255,.68)' : 'rgba(225,210,255,.58)')
    glow.addColorStop(0.44, isDark ? 'rgba(147,51,234,.38)' : 'rgba(66,133,244,.28)')
    glow.addColorStop(1, 'rgba(235,68,90,0)')
  } else if (theme === 'claude') {
    glow.addColorStop(0, isDark ? 'rgba(255,255,255,.94)' : 'rgba(255,255,255,.95)')
    glow.addColorStop(0.14, isDark ? 'rgba(255,220,180,.65)' : 'rgba(255,225,190,.58)')
    glow.addColorStop(0.44, isDark ? 'rgba(240,120,30,.36)' : 'rgba(235,115,30,.28)')
    glow.addColorStop(1, isDark ? 'rgba(180,50,0,0)' : 'rgba(190,60,10,0)')
  } else if (theme === 'kimi') {
    glow.addColorStop(0, isDark ? 'rgba(255,255,255,.96)' : 'rgba(255,255,255,.96)')
    glow.addColorStop(0.14, isDark ? 'rgba(230,240,255,.68)' : 'rgba(220,230,255,.58)')
    glow.addColorStop(0.44, isDark ? 'rgba(92,116,232,.42)' : 'rgba(75,98,215,.32)')
    glow.addColorStop(0.78, isDark ? 'rgba(255,215,105,.18)' : 'rgba(245,195,75,.12)')
    glow.addColorStop(1, 'rgba(15,22,55,0)')
  } else if (theme === 'glm') {
    glow.addColorStop(0, isDark ? 'rgba(255,255,255,.96)' : 'rgba(255,255,255,.96)')
    glow.addColorStop(0.14, isDark ? 'rgba(224,242,254,.68)' : 'rgba(215,235,255,.58)')
    glow.addColorStop(0.44, isDark ? 'rgba(14,165,233,.42)' : 'rgba(2,132,199,.32)')
    glow.addColorStop(0.78, isDark ? 'rgba(56,189,248,.18)' : 'rgba(14,165,233,.12)')
    glow.addColorStop(1, 'rgba(5,15,30,0)')
  } else if (theme === 'qwen') {
    glow.addColorStop(0, isDark ? 'rgba(255,255,255,.96)' : 'rgba(255,255,255,.96)')
    glow.addColorStop(0.14, isDark ? 'rgba(219,234,254,.68)' : 'rgba(210,230,255,.58)')
    glow.addColorStop(0.44, isDark ? 'rgba(59,130,246,.42)' : 'rgba(37,99,235,.32)')
    glow.addColorStop(0.78, isDark ? 'rgba(251,191,36,.18)' : 'rgba(245,158,11,.12)')
    glow.addColorStop(1, 'rgba(12,21,56,0)')
  } else if (theme === 'minimax') {
    glow.addColorStop(0, 'rgba(255,255,255,.98)')
    glow.addColorStop(0.14, isDark ? 'rgba(255,225,210,.72)' : 'rgba(255,215,200,.62)')
    glow.addColorStop(0.44, isDark ? 'rgba(255,115,70,.46)' : 'rgba(255,95,55,.36)')
    glow.addColorStop(0.78, isDark ? 'rgba(255,80,50,.2)' : 'rgba(240,65,40,.14)')
    glow.addColorStop(1, 'rgba(50,15,10,0)')
  } else if (theme === 'openai') {
    glow.addColorStop(0, isDark ? 'rgba(255,255,255,.92)' : 'rgba(255,255,255,.94)')
    glow.addColorStop(0.14, isDark ? 'rgba(225,180,255,.62)' : 'rgba(220,180,255,.54)')
    glow.addColorStop(0.44, isDark ? 'rgba(160,70,255,.34)' : 'rgba(150,55,230,.26)')
    glow.addColorStop(1, isDark ? 'rgba(110,25,200,0)' : 'rgba(100,20,180,0)')
  } else {
    glow.addColorStop(0, isDark ? 'rgba(255,255,255,.82)' : 'rgba(255,255,255,.86)')
    glow.addColorStop(0.14, isDark ? 'rgba(183,190,255,.54)' : 'rgba(162,210,255,.48)')
    glow.addColorStop(0.44, isDark ? 'rgba(103,74,255,.28)' : 'rgba(37,112,207,.22)')
    glow.addColorStop(1, isDark ? 'rgba(86,31,210,0)' : 'rgba(25,91,181,0)')
  }
  context.fillStyle = glow
  context.fillRect(origin - 26, 0, 52, height)
  context.restore()
}

