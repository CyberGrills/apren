import { useEffect, useState } from 'react';
import { useSevenLanguage } from '../lib/sevenLanguage.ts';
import './scroll-pilot-scene.css';

export function ScrollPilotScene() {
  return (
    <section className="seven-pilot-scroll" aria-labelledby="seven-pilot-title">
      <div className="seven-pilot-sticky">
        <div className="seven-pilot-copy">
          <p className="public-eyebrow">Your virtual travel pilot</p>
          <h2 id="seven-pilot-title">A better stay starts with a clearer journey.</h2>
          <p>
            Explore the details at your pace. 7even brings verified stay information into focus;
            you stay in control of every search and booking decision.
          </p>
          <span className="seven-pilot-note">Scroll to explore · No booking action is triggered</span>
        </div>
        <div className="seven-pilot-stage" aria-hidden="true">
          <div className="seven-pilot-orbit seven-pilot-orbit-one" />
          <div className="seven-pilot-orbit seven-pilot-orbit-two" />
          <div className="seven-pilot-horizon" />
          <div className="seven-pilot-glow" />
          <div className={speaking ? "seven-pilot-avatar is-speaking" : "seven-pilot-avatar"}>
            <svg
              className="seven-pilot-portrait"
              viewBox="0 0 340 430"
              role="presentation"
              focusable="false"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <linearGradient id="pilot-skin" x1="0" y1="0" x2="1" y2="0.8">
                  <stop offset="0" stopColor="#4c251b" />
                  <stop offset="0.24" stopColor="#8d4c32" />
                  <stop offset="0.48" stopColor="#b96f4b" />
                  <stop offset="0.72" stopColor="#875036" />
                  <stop offset="1" stopColor="#351b16" />
                </linearGradient>
                <linearGradient id="pilot-face-light" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#f3b184" stopOpacity=".62" />
                  <stop offset=".45" stopColor="#d58a5f" stopOpacity=".16" />
                  <stop offset="1" stopColor="#24100d" stopOpacity=".52" />
                </linearGradient>
                <linearGradient id="pilot-jacket" x1="0" y1="0" x2="1" y2=".2">
                  <stop offset="0" stopColor="#0b2c23" />
                  <stop offset=".28" stopColor="#1b4a39" />
                  <stop offset=".52" stopColor="#28624b" />
                  <stop offset=".78" stopColor="#164332" />
                  <stop offset="1" stopColor="#08251e" />
                </linearGradient>
                <linearGradient id="pilot-shirt" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0" stopColor="#b9a985" />
                  <stop offset=".5" stopColor="#f7edda" />
                  <stop offset="1" stopColor="#cfc09e" />
                </linearGradient>
                <linearGradient id="pilot-hair" x1="0" y1="0" x2="0.8" y2="1">
                  <stop offset="0" stopColor="#29211c" />
                  <stop offset=".5" stopColor="#100f0d" />
                  <stop offset="1" stopColor="#33241d" />
                </linearGradient>
                <radialGradient id="pilot-cheek" cx=".36" cy=".35" r=".7">
                  <stop offset="0" stopColor="#e5a078" stopOpacity=".45" />
                  <stop offset="1" stopColor="#a24e34" stopOpacity="0" />
                </radialGradient>
                <filter id="pilot-shadow" x="-30%" y="-20%" width="160%" height="160%">
                  <feDropShadow dx="0" dy="18" stdDeviation="14" floodColor="#061b15" floodOpacity=".28" />
                </filter>
                <pattern id="pilot-coils" width="12" height="10" patternUnits="userSpaceOnUse">
                  <circle cx="3" cy="3" r="2.1" fill="#39302a" />
                  <circle cx="9" cy="7" r="2.3" fill="#080908" />
                  <circle cx="3" cy="3" r=".7" fill="#776050" opacity=".55" />
                </pattern>
              </defs>

              <ellipse cx="171" cy="398" rx="100" ry="14" fill="#102d23" opacity=".14" />
              <g filter="url(#pilot-shadow)">
                <path d="M96 278 Q109 254 132 251 L208 251 Q233 255 247 281 L291 398 L49 398 Z" fill="url(#pilot-jacket)" />
                <path d="M127 253 L170 281 L212 253 L230 272 L202 398 L139 398 L110 272 Z" fill="#12382b" opacity=".9" />
                <path d="M145 256 L170 283 L196 256 L213 276 L192 350 L149 350 L127 276 Z" fill="url(#pilot-shirt)" />
                <path d="M128 254 L151 263 L170 292 L145 321 L117 274 Z" fill="#e9ddc4" />
                <path d="M212 254 L190 263 L170 292 L195 321 L223 274 Z" fill="#d6c6a4" />
                <path d="M95 279 Q113 267 129 274 L149 398 L50 398 Z" fill="url(#pilot-jacket)" />
                <path d="M245 279 Q227 267 211 274 L191 398 L290 398 Z" fill="url(#pilot-jacket)" />
                <path d="M169 293 L170 383" stroke="#071f18" strokeWidth="2" opacity=".5" />
                <path d="M83 320 L115 310 M224 310 L257 320" stroke="#8eaa91" strokeWidth="1.5" opacity=".24" />

                <path d="M145 222 L145 274 Q170 300 195 274 L195 222 Z" fill="url(#pilot-skin)" />
                <path d="M145 236 Q170 256 195 236 L195 266 Q170 286 145 266 Z" fill="#5a2c20" opacity=".4" />

                <path d="M110 120 Q109 72 170 69 Q231 72 230 120 L224 183 Q218 232 170 243 Q122 232 116 183 Z" fill="url(#pilot-skin)" />
                <path d="M110 120 Q109 72 170 69 Q231 72 230 120 L224 183 Q218 232 170 243 Q122 232 116 183 Z" fill="url(#pilot-face-light)" />
                <ellipse cx="128" cy="173" rx="29" ry="39" fill="url(#pilot-cheek)" />
                <ellipse cx="211" cy="173" rx="27" ry="38" fill="url(#pilot-cheek)" />

                <path d="M114 147 Q100 143 102 167 Q105 190 119 188 L122 160 Z" fill="url(#pilot-skin)" />
                <path d="M226 147 Q240 143 238 167 Q235 190 221 188 L218 160 Z" fill="url(#pilot-skin)" />
                <path d="M108 161 Q114 172 109 179" stroke="#4a2119" strokeWidth="3" fill="none" opacity=".6" />
                <path d="M232 161 Q226 172 231 179" stroke="#4a2119" strokeWidth="3" fill="none" opacity=".6" />

                <path d="M109 124 Q104 86 133 76 Q171 57 208 75 Q239 89 231 130 L222 118 Q217 102 205 99 Q172 112 137 98 Q126 107 119 129 Z" fill="url(#pilot-hair)" />
                <path d="M109 111 Q109 83 137 73 Q172 57 205 74 Q230 87 231 112 L224 122 Q220 103 206 98 Q174 109 137 98 Q121 107 116 125 Z" fill="url(#pilot-coils)" />
                <path d="M111 111 Q116 82 145 75" stroke="#78604c" strokeWidth="2" opacity=".35" fill="none" />
                <path d="M137 78 Q169 65 200 78" stroke="#8e7761" strokeWidth="1.5" opacity=".22" fill="none" />

                <path d="M128 143 Q143 133 157 142" stroke="#2b1712" strokeWidth="7" strokeLinecap="round" fill="none" />
                <path d="M183 142 Q198 133 212 143" stroke="#2b1712" strokeWidth="7" strokeLinecap="round" fill="none" />
                <path d="M128 148 Q142 141 156 148" stroke="#d8a078" strokeWidth="1.8" opacity=".6" fill="none" />
                <path d="M184 148 Q198 141 212 148" stroke="#d8a078" strokeWidth="1.8" opacity=".6" fill="none" />
                <path d="M129 157 Q142 151 156 157" stroke="#261512" strokeWidth="5.5" strokeLinecap="round" fill="none" />
                <path d="M184 157 Q198 151 211 157" stroke="#261512" strokeWidth="5.5" strokeLinecap="round" fill="none" />
                <ellipse cx="143" cy="157" rx="3.8" ry="4.2" fill="#17100e" />
                <ellipse cx="198" cy="157" rx="3.8" ry="4.2" fill="#17100e" />
                <circle cx="144" cy="155.5" r="1.2" fill="#f5d4b1" />
                <circle cx="199" cy="155.5" r="1.2" fill="#f5d4b1" />

                <path d="M171 154 Q166 174 161 185 Q170 193 182 186" stroke="#5c2c20" strokeWidth="3" strokeLinecap="round" fill="none" opacity=".72" />
                <path d="M163 186 Q171 190 181 185" stroke="#d38b60" strokeWidth="2" strokeLinecap="round" fill="none" opacity=".65" />
                <path d="M146 207 Q170 223 195 206 Q190 232 170 232 Q151 230 146 207 Z" fill="#4a201a" />
                <path d="M149 208 Q170 218 192 208 Q186 220 170 221 Q155 220 149 208 Z" fill="#f0d5bd" />
                <path d="M153 225 Q170 232 188 224" stroke="#7d3829" strokeWidth="2" fill="none" opacity=".7" />
                <path d="M124 181 Q134 190 145 185 M195 185 Q207 190 217 180" stroke="#e6a078" strokeWidth="2" fill="none" opacity=".24" />

                <path d="M78 398 L92 320 Q95 305 109 301 L142 325 L170 355 L198 325 L231 301 Q245 305 248 320 L262 398 Z" fill="url(#pilot-jacket)" />
                <path d="M142 325 L170 355 L198 325 L186 398 L154 398 Z" fill="#0d2a21" opacity=".62" />
                <path d="M130 308 L150 328 L170 355 L151 373 L128 330 Z" fill="#e7dac0" />
                <path d="M210 308 L190 328 L170 355 L189 373 L212 330 Z" fill="#cbb994" />
                <path d="M170 355 L170 398" stroke="#d8c6a2" strokeWidth="1" opacity=".6" />
                <path d="M219 330 L237 338" stroke="#a4b8a1" strokeWidth="1.2" opacity=".4" />
                <rect x="212" y="328" width="24" height="24" rx="12" fill="#d8c39a" />
                <circle cx="224" cy="340" r="10" fill="#173e30" />
                <text x="224" y="345" textAnchor="middle" fontFamily="Georgia, serif" fontSize="15" fontWeight="bold" fill="#f0dfbc">7</text>

                <path d="M120 176 Q123 198 139 211" stroke="#e9b28a" strokeWidth="2" fill="none" opacity=".3" />
                <path d="M215 174 Q212 197 199 210" stroke="#2e1712" strokeWidth="2" fill="none" opacity=".3" />
                <path d="M130 117 Q149 103 170 106" stroke="#f5c29a" strokeWidth="2" fill="none" opacity=".18" />
              </g>
            </svg>
          </div>
          <div className="seven-pilot-orbit-label seven-pilot-label-top">DISCOVER</div>
          <div className="seven-pilot-orbit-label seven-pilot-label-bottom">DECIDE AT YOUR PACE</div>
        </div>
        <div className="seven-pilot-audio" aria-label="Virtual pilot audio controls">
          <div className="seven-pilot-audio-actions">
            <button type="button" className="btn btn-primary" onClick={speakPilot} disabled={muted || speaking}>Speak</button>
            <button type="button" className="btn btn-secondary" onClick={pausePilot} disabled={!speaking}>Pause / resume</button>
            <button type="button" className="btn btn-secondary" onClick={mutePilot} aria-pressed={muted}>{muted ? 'Unmute' : 'Mute'}</button>
            <button type="button" className="btn btn-secondary" onClick={speakPilot} disabled={muted}>Replay</button>
          </div>
          <p className="seven-pilot-caption" aria-live="polite">{caption}</p>
          <p className="seven-pilot-voice-note" role="status">{voiceNote || 'Audio starts only when you choose Speak. Available voices vary by device; captions are always shown.'}</p>
        </div>
      </div>
    </section>
  );
}
