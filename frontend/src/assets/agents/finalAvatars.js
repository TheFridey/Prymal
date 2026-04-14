function buildAvatar({ id, bgStart, bgEnd, glow, accent, accentSoft, markup }) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none">
      <defs>
        <linearGradient id="${id}-bg" x1="72" y1="56" x2="448" y2="464" gradientUnits="userSpaceOnUse">
          <stop stop-color="${bgStart}" />
          <stop offset="1" stop-color="${bgEnd}" />
        </linearGradient>
        <radialGradient id="${id}-glow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(256 224) rotate(90) scale(220)">
          <stop stop-color="${glow}" stop-opacity="0.9" />
          <stop offset="1" stop-color="${glow}" stop-opacity="0" />
        </radialGradient>
        <linearGradient id="${id}-accent" x1="132" y1="120" x2="380" y2="392" gradientUnits="userSpaceOnUse">
          <stop stop-color="${accent}" />
          <stop offset="1" stop-color="${accentSoft}" />
        </linearGradient>
        <filter id="${id}-blur" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="16" />
        </filter>
      </defs>
      <rect width="512" height="512" rx="148" fill="url(#${id}-bg)" />
      <rect x="20" y="20" width="472" height="472" rx="132" stroke="rgba(255,255,255,0.12)" stroke-width="2" />
      <circle cx="256" cy="224" r="168" fill="url(#${id}-glow)" />
      <g opacity="0.18" stroke="rgba(255,255,255,0.22)">
        <path d="M116 146H396" />
        <path d="M136 376H376" />
        <path d="M122 258H390" />
      </g>
      <g filter="url(#${id}-blur)" opacity="0.55">
        <circle cx="256" cy="236" r="108" fill="${glow}" />
      </g>
      <g>
        ${markup}
      </g>
    </svg>
  `.trim();

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export const cipherAvatar = buildAvatar({
  id: 'cipher',
  bgStart: '#09111E',
  bgEnd: '#04070C',
  glow: '#33C7FF',
  accent: '#BEE9FF',
  accentSoft: '#33C7FF',
  markup: `
    <path d="M185 154H327" stroke="url(#cipher-accent)" stroke-width="18" stroke-linecap="round"/>
    <path d="M206 202C206 176 228 154 255 154C281 154 303 176 303 202C303 229 281 250 255 250C229 250 206 272 206 299C206 325 228 347 255 347C281 347 303 325 303 299" stroke="url(#cipher-accent)" stroke-width="18" stroke-linecap="round"/>
    <circle cx="161" cy="192" r="14" fill="#8FE3FF"/>
    <circle cx="351" cy="182" r="10" fill="#8FE3FF"/>
    <circle cx="346" cy="320" r="12" fill="#8FE3FF"/>
    <path d="M175 192L214 192" stroke="#8FE3FF" stroke-width="8" stroke-linecap="round"/>
    <path d="M303 182L339 182" stroke="#8FE3FF" stroke-width="8" stroke-linecap="round"/>
    <path d="M303 320L334 320" stroke="#8FE3FF" stroke-width="8" stroke-linecap="round"/>
  `,
});

export const heraldAvatar = buildAvatar({
  id: 'herald',
  bgStart: '#1B1011',
  bgEnd: '#07090F',
  glow: '#FF8B5F',
  accent: '#FFD4C4',
  accentSoft: '#FF8B5F',
  markup: `
    <path d="M145 302L232 204C246 188 271 188 285 204L367 284" stroke="url(#herald-accent)" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M170 281V332C170 347 182 359 197 359H315C330 359 342 347 342 332V281" stroke="url(#herald-accent)" stroke-width="18" stroke-linecap="round"/>
    <path d="M146 242C184 220 214 214 238 222C214 236 188 256 158 284" fill="#FF8B5F" fill-opacity="0.22"/>
    <path d="M334 195C364 204 386 221 400 247C368 243 340 252 316 272" fill="#FF8B5F" fill-opacity="0.18"/>
  `,
});

export const loreAvatar = buildAvatar({
  id: 'lore',
  bgStart: '#130C20',
  bgEnd: '#06070F',
  glow: '#996DFF',
  accent: '#E3D9FF',
  accentSoft: '#996DFF',
  markup: `
    <path d="M176 176C204 168 231 168 256 186C281 168 308 168 336 176V330C308 322 281 322 256 340C231 322 204 322 176 330V176Z" fill="url(#lore-accent)" fill-opacity="0.92"/>
    <path d="M256 190V340" stroke="#171B2B" stroke-width="10" stroke-linecap="round"/>
    <path d="M208 226H240" stroke="#171B2B" stroke-width="8" stroke-linecap="round"/>
    <path d="M272 226H304" stroke="#171B2B" stroke-width="8" stroke-linecap="round"/>
    <path d="M208 266H232" stroke="#171B2B" stroke-width="8" stroke-linecap="round"/>
    <path d="M280 266H304" stroke="#171B2B" stroke-width="8" stroke-linecap="round"/>
  `,
});

export const forgeAvatar = buildAvatar({
  id: 'forge',
  bgStart: '#17130A',
  bgEnd: '#06070F',
  glow: '#F8C44F',
  accent: '#FFF1B3',
  accentSoft: '#F8C44F',
  markup: `
    <path d="M212 182L308 278" stroke="url(#forge-accent)" stroke-width="22" stroke-linecap="round"/>
    <path d="M184 294L236 242L314 320C326 332 326 350 314 362C302 374 284 374 272 362L184 294Z" fill="url(#forge-accent)"/>
    <path d="M284 154L296 182" stroke="#FDE68A" stroke-width="10" stroke-linecap="round"/>
    <path d="M318 166L336 184" stroke="#FDE68A" stroke-width="10" stroke-linecap="round"/>
    <path d="M328 136L330 162" stroke="#FDE68A" stroke-width="10" stroke-linecap="round"/>
  `,
});

export const atlasAvatar = buildAvatar({
  id: 'atlas',
  bgStart: '#07111C',
  bgEnd: '#05070E',
  glow: '#40D7C3',
  accent: '#CBFFF6',
  accentSoft: '#7FDBFF',
  markup: `
    <circle cx="256" cy="256" r="54" fill="url(#atlas-accent)" fill-opacity="0.94"/>
    <ellipse cx="256" cy="256" rx="118" ry="58" stroke="url(#atlas-accent)" stroke-width="12"/>
    <ellipse cx="256" cy="256" rx="118" ry="58" stroke="url(#atlas-accent)" stroke-width="12" transform="rotate(60 256 256)"/>
    <ellipse cx="256" cy="256" rx="118" ry="58" stroke="url(#atlas-accent)" stroke-width="12" transform="rotate(-60 256 256)"/>
    <circle cx="364" cy="228" r="12" fill="#CBFFF6"/>
    <circle cx="178" cy="318" r="10" fill="#CBFFF6"/>
  `,
});

export const echoAvatar = buildAvatar({
  id: 'echo',
  bgStart: '#180B15',
  bgEnd: '#05070E',
  glow: '#FF5C98',
  accent: '#FFD3E2',
  accentSoft: '#FF5C98',
  markup: `
    <circle cx="256" cy="256" r="28" fill="url(#echo-accent)"/>
    <circle cx="256" cy="256" r="72" stroke="url(#echo-accent)" stroke-width="12" opacity="0.9"/>
    <circle cx="256" cy="256" r="114" stroke="url(#echo-accent)" stroke-width="10" opacity="0.68"/>
    <circle cx="256" cy="256" r="152" stroke="url(#echo-accent)" stroke-width="8" opacity="0.46"/>
  `,
});

export const pixelAvatar = buildAvatar({
  id: 'pixel',
  bgStart: '#08080C',
  bgEnd: '#04050A',
  glow: '#FF9EFF',
  accent: '#FFD2FF',
  accentSoft: '#8A8BFF',
  markup: `
    <path d="M214 176L332 246L214 318V176Z" fill="url(#pixel-accent)"/>
    <path d="M214 246H140" stroke="#FFD2FF" stroke-width="12" stroke-linecap="round"/>
    <path d="M332 246L392 210" stroke="#FF7AC8" stroke-width="12" stroke-linecap="round"/>
    <path d="M332 246L396 246" stroke="#8A8BFF" stroke-width="12" stroke-linecap="round"/>
    <path d="M332 246L392 282" stroke="#6EE7F9" stroke-width="12" stroke-linecap="round"/>
  `,
});

export const oracleAvatar = buildAvatar({
  id: 'oracle',
  bgStart: '#09140F',
  bgEnd: '#05070E',
  glow: '#62DCA5',
  accent: '#D7FFE6',
  accentSoft: '#62DCA5',
  markup: `
    <circle cx="256" cy="256" r="118" stroke="url(#oracle-accent)" stroke-width="12"/>
    <circle cx="256" cy="256" r="50" stroke="url(#oracle-accent)" stroke-width="12"/>
    <path d="M256 156V206" stroke="url(#oracle-accent)" stroke-width="12" stroke-linecap="round"/>
    <path d="M256 306V356" stroke="url(#oracle-accent)" stroke-width="12" stroke-linecap="round"/>
    <path d="M156 256H206" stroke="url(#oracle-accent)" stroke-width="12" stroke-linecap="round"/>
    <path d="M306 256H356" stroke="url(#oracle-accent)" stroke-width="12" stroke-linecap="round"/>
  `,
});

export const vanceAvatar = buildAvatar({
  id: 'vance',
  bgStart: '#1A100A',
  bgEnd: '#05070E',
  glow: '#FF7A3C',
  accent: '#FFDCC8',
  accentSoft: '#FF7A3C',
  markup: `
    <path d="M176 328L306 198" stroke="url(#vance-accent)" stroke-width="24" stroke-linecap="round"/>
    <path d="M258 198H336V276" stroke="url(#vance-accent)" stroke-width="24" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M176 328H334" stroke="#FFB089" stroke-width="12" stroke-linecap="round" opacity="0.48"/>
  `,
});

export const wrenAvatar = buildAvatar({
  id: 'wren',
  bgStart: '#0B1516',
  bgEnd: '#05070E',
  glow: '#85D4A8',
  accent: '#E4FFF0',
  accentSoft: '#85D4A8',
  markup: `
    <path d="M256 150L280 216L346 190L300 244L364 256L300 268L346 322L280 296L256 362L232 296L166 322L212 268L148 256L212 244L166 190L232 216L256 150Z" fill="url(#wren-accent)"/>
  `,
});

export const ledgerAvatar = buildAvatar({
  id: 'ledger',
  bgStart: '#0B141A',
  bgEnd: '#05070E',
  glow: '#7EC4DA',
  accent: '#D8F5FF',
  accentSoft: '#7EC4DA',
  markup: `
    <rect x="164" y="170" width="58" height="58" rx="12" fill="url(#ledger-accent)"/>
    <rect x="236" y="170" width="58" height="58" rx="12" fill="url(#ledger-accent)" opacity="0.88"/>
    <rect x="308" y="170" width="40" height="58" rx="12" fill="url(#ledger-accent)" opacity="0.72"/>
    <rect x="164" y="242" width="58" height="100" rx="12" fill="url(#ledger-accent)" opacity="0.72"/>
    <rect x="236" y="242" width="58" height="58" rx="12" fill="url(#ledger-accent)"/>
    <rect x="308" y="242" width="40" height="100" rx="12" fill="url(#ledger-accent)" opacity="0.9"/>
  `,
});

export const nexusAvatar = buildAvatar({
  id: 'nexus',
  bgStart: '#0A1120',
  bgEnd: '#05070E',
  glow: '#6D8AFF',
  accent: '#D7E2FF',
  accentSoft: '#6D8AFF',
  markup: `
    <path d="M256 162L326 202V282L256 322L186 282V202L256 162Z" stroke="url(#nexus-accent)" stroke-width="16" stroke-linejoin="round"/>
    <circle cx="256" cy="242" r="16" fill="#D7E2FF"/>
    <circle cx="178" cy="170" r="12" fill="#D7E2FF"/>
    <circle cx="334" cy="170" r="12" fill="#D7E2FF"/>
    <circle cx="382" cy="256" r="12" fill="#D7E2FF"/>
    <circle cx="334" cy="342" r="12" fill="#D7E2FF"/>
    <circle cx="178" cy="342" r="12" fill="#D7E2FF"/>
    <circle cx="130" cy="256" r="12" fill="#D7E2FF"/>
    <path d="M256 226L178 170M256 226L334 170M272 242L382 256M272 258L334 342M240 258L178 342M240 242L130 256" stroke="url(#nexus-accent)" stroke-width="10" stroke-linecap="round"/>
  `,
});

export const scoutAvatar = buildAvatar({
  id: 'scout',
  bgStart: '#190E13',
  bgEnd: '#05070E',
  glow: '#FF9AA5',
  accent: '#FFDADF',
  accentSoft: '#FF9AA5',
  markup: `
    <circle cx="256" cy="256" r="116" stroke="url(#scout-accent)" stroke-width="12" opacity="0.82"/>
    <path d="M256 170L300 256L256 342L212 256L256 170Z" fill="url(#scout-accent)"/>
    <path d="M256 194L278 256L256 318L234 256L256 194Z" fill="#0F1220"/>
    <circle cx="336" cy="190" r="10" fill="#FFDADF"/>
    <circle cx="176" cy="322" r="12" fill="#FFDADF"/>
  `,
});

export const sageAvatar = buildAvatar({
  id: 'sage',
  bgStart: '#17120D',
  bgEnd: '#05070E',
  glow: '#C3925B',
  accent: '#F6E3C8',
  accentSoft: '#C3925B',
  markup: `
    <circle cx="256" cy="256" r="112" stroke="url(#sage-accent)" stroke-width="10" opacity="0.42"/>
    <path d="M256 162L282 230L350 256L282 282L256 350L230 282L162 256L230 230L256 162Z" fill="url(#sage-accent)"/>
    <circle cx="256" cy="256" r="22" fill="#17120D"/>
  `,
});

export const sentinelAvatar = buildAvatar({
  id: 'sentinel',
  bgStart: '#170A12',
  bgEnd: '#05070E',
  glow: '#FF3B6B',
  accent: '#FFD5E1',
  accentSoft: '#FF3B6B',
  markup: `
    <path d="M256 154L336 188V248C336 308 302 354 256 374C210 354 176 308 176 248V188L256 154Z" stroke="url(#sentinel-accent)" stroke-width="16" stroke-linejoin="round"/>
    <circle cx="256" cy="248" r="34" stroke="url(#sentinel-accent)" stroke-width="12"/>
    <path d="M256 186V214M256 282V310M194 248H222M290 248H318" stroke="url(#sentinel-accent)" stroke-width="10" stroke-linecap="round"/>
  `,
});
