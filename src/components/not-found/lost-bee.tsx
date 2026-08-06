/**
 * 卡通迷路小蜜蜂 —— 404 页主视觉（纯 SVG，无外部资源）
 * 圆滚滚的身体、大眼、腮红、小翅膀，符合蜂巢品牌卡通调性
 */
export function LostBee() {
  return (
    <svg
      viewBox="0 0 240 240"
      className="mx-auto w-56 max-w-full drop-shadow-lg sm:w-64"
      role="img"
      aria-label="一只迷路的小蜜蜂"
    >
      {/* 翅膀（后面） */}
      <ellipse cx="78" cy="118" rx="30" ry="42" fill="oklch(0.95 0.02 200 / 0.55)" transform="rotate(-24 78 118)" />
      <ellipse cx="162" cy="118" rx="30" ry="42" fill="oklch(0.95 0.02 200 / 0.55)" transform="rotate(24 162 118)" />

      {/* 触角 */}
      <path
        d="M108 52 Q 96 24 76 30"
        fill="none"
        stroke="oklch(0.35 0 0)"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <circle cx="74" cy="29" r="6" fill="oklch(0.35 0 0)" />
      <path
        d="M132 52 Q 144 24 164 30"
        fill="none"
        stroke="oklch(0.35 0 0)"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <circle cx="166" cy="29" r="6" fill="oklch(0.35 0 0)" />

      {/* 头部 */}
      <circle cx="120" cy="78" r="40" fill="oklch(0.82 0.17 84)" />
      {/* 头部条纹 */}
      <path d="M84 70 Q120 82 156 70" fill="none" stroke="oklch(0.45 0.12 70)" strokeWidth="7" strokeLinecap="round" opacity="0.5" />

      {/* 身体 */}
      <ellipse cx="120" cy="152" rx="52" ry="58" fill="oklch(0.85 0.18 84)" />
      {/* 条纹 */}
      <path d="M80 128 Q120 142 160 128" fill="none" stroke="oklch(0.4 0.1 70)" strokeWidth="14" strokeLinecap="round" />
      <path d="M74 152 Q120 168 166 152" fill="none" stroke="oklch(0.4 0.1 70)" strokeWidth="14" strokeLinecap="round" />
      <path d="M80 176 Q120 190 160 176" fill="none" stroke="oklch(0.4 0.1 70)" strokeWidth="14" strokeLinecap="round" opacity="0.8" />

      {/* 肚子高光 */}
      <ellipse cx="108" cy="190" rx="14" ry="8" fill="oklch(1 0 0 / 0.35)" />

      {/* 眼睛 */}
      <ellipse cx="103" cy="72" rx="10" ry="13" fill="white" />
      <ellipse cx="137" cy="72" rx="10" ry="13" fill="white" />
      <circle cx="105" cy="74" r="5.5" fill="oklch(0.25 0 0)" />
      <circle cx="139" cy="74" r="5.5" fill="oklch(0.25 0 0)" />
      {/* 高光 */}
      <circle cx="107" cy="71" r="2" fill="white" />
      <circle cx="141" cy="71" r="2" fill="white" />

      {/* 腮红 */}
      <ellipse cx="86" cy="90" rx="8" ry="5" fill="oklch(0.78 0.17 15 / 0.6)" />
      <ellipse cx="154" cy="90" rx="8" ry="5" fill="oklch(0.78 0.17 15 / 0.6)" />

      {/* 微笑 */}
      <path d="M110 92 Q120 100 130 92" fill="none" stroke="oklch(0.35 0 0)" strokeWidth="3.5" strokeLinecap="round" />

      {/* 腮帮子鼓起 */}
      <path d="M104 100 Q120 110 136 100" fill="none" stroke="oklch(0.45 0.12 70)" strokeWidth="3" strokeLinecap="round" opacity="0.5" />

      {/* 腿 */}
      <path d="M88 202 L78 216" stroke="oklch(0.35 0 0)" strokeWidth="4" strokeLinecap="round" />
      <path d="M120 206 L120 220" stroke="oklch(0.35 0 0)" strokeWidth="4" strokeLinecap="round" />
      <path d="M152 202 L162 216" stroke="oklch(0.35 0 0)" strokeWidth="4" strokeLinecap="round" />

      {/* 举着的小牌子 */}
      <g transform="rotate(-8 178 118)">
        <rect x="160" y="96" width="56" height="38" rx="8" fill="oklch(0.98 0.98 0)" stroke="oklch(0.75 0.16 85)" strokeWidth="3" />
        <text
          x="188"
          y="122"
          textAnchor="middle"
          fontSize="20"
          fontWeight="800"
          fill="oklch(0.55 0.16 70)"
          fontFamily="sans-serif"
        >
          404?
        </text>
        <path d="M180 134 L180 176" stroke="oklch(0.6 0.12 75)" strokeWidth="4" strokeLinecap="round" />
      </g>
    </svg>
  );
}
