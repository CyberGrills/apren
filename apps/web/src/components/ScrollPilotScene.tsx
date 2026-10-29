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
          <div className="seven-pilot-avatar">
            <div className="seven-pilot-halo" />
            <div className="seven-pilot-head">
              <div className="seven-pilot-hair" />
              <div className="seven-pilot-ear seven-pilot-ear-left" />
              <div className="seven-pilot-ear seven-pilot-ear-right" />
              <div className="seven-pilot-face">
                <span className="seven-pilot-brow seven-pilot-brow-left" />
                <span className="seven-pilot-brow seven-pilot-brow-right" />
                <span className="seven-pilot-eye seven-pilot-eye-left" />
                <span className="seven-pilot-eye seven-pilot-eye-right" />
                <span className="seven-pilot-nose" />
                <span className="seven-pilot-mouth" />
              </div>
              <div className="seven-pilot-neck" />
            </div>
            <div className="seven-pilot-jacket">
              <div className="seven-pilot-collar seven-pilot-collar-left" />
              <div className="seven-pilot-collar seven-pilot-collar-right" />
              <div className="seven-pilot-shirt" />
              <div className="seven-pilot-badge">7</div>
            </div>
          </div>
          <div className="seven-pilot-orbit-label seven-pilot-label-top">DISCOVER</div>
          <div className="seven-pilot-orbit-label seven-pilot-label-bottom">DECIDE AT YOUR PACE</div>
        </div>
      </div>
    </section>
  );
}
