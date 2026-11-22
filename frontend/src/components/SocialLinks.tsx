type SocialPlatform = 'facebook' | 'instagram' | 'x';

function SocialIcon({ platform }: { platform: SocialPlatform }) {
  if (platform === 'facebook') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.4 21v-8.2h2.8l.4-3.2h-3.2V7.5c0-.9.3-1.6 1.6-1.6h1.7V3.1c-.3 0-1.3-.1-2.4-.1-2.5 0-4.2 1.5-4.2 4.3v2.3H7.3v3.2h2.8V21h3.3Z" fill="currentColor" /></svg>;
  }
  if (platform === 'instagram') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5.1" fill="none" stroke="currentColor" strokeWidth="1.8" /><circle cx="12" cy="12" r="4.1" fill="none" stroke="currentColor" strokeWidth="1.8" /><circle cx="17.7" cy="6.6" r="1.1" fill="currentColor" /></svg>;
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.9 3H21l-6.9 7.9L22.2 21h-6.3l-4.9-6.4L5.4 21H3.3l7.4-8.5L2.8 3h6.5l4.4 5.9L18.9 3Zm-1.1 16.2H19L8.1 4.7H6.8l11 14.5Z" fill="currentColor" /></svg>;
}

export function SocialLinks({ compact = false }: { compact?: boolean }) {
  return (
    <section className={compact ? 'seven-social-links seven-social-links-compact' : 'seven-social-links'} aria-label="7EVEN social media">
      <p className="seven-social-heading">Follow 7EVEN</p>
      <div className="seven-social-list">
        <a href="https://www.facebook.com/share/1Cqq8CAJPa/" target="_blank" rel="noopener noreferrer" aria-label="7EVEN on Facebook">
          <SocialIcon platform="facebook" /><span>Facebook</span>
        </a>
        <a href="https://www.instagram.com/7even_aprene?vrfl=MTBpdTVwaTUwbGxvMQ==" target="_blank" rel="noopener noreferrer" aria-label="7EVEN on Instagram">
          <SocialIcon platform="instagram" /><span>Instagram</span>
        </a>
        <a href="https://x.com/7seven_aprene" target="_blank" rel="noopener noreferrer" aria-label="7EVEN on X">
          <SocialIcon platform="x" /><span>X</span>
        </a>
      </div>
    </section>
  );
}
