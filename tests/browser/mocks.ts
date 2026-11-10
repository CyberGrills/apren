import type { Page, Route } from '@playwright/test';

export const session = (role: 'CUSTOMER' | 'BUSINESS_OWNER' | 'RECEPTION' | 'ADMIN' | null) => ({
  data: {
    user: role ? { id: `browser-${role.toLowerCase()}`, email: 'browser@example.test', displayName: 'Browser Test', role, businessId: role === 'BUSINESS_OWNER' || role === 'RECEPTION' ? 'business-test' : null, venueIds: [] } : null,
    csrfToken: 'browser-csrf', environment: 'test', paymentMode: 'test',
  },
});

const creatorProfile = {
  creatorId: 'creator-test', slug: 'test-creator', displayName: 'Test Creator',
  location: { city: 'Uyo', region: 'Akwa Ibom', countryCode: 'NG' },
  disciplines: ['Digital art'], biography: 'An artist exploring contemporary African visual storytelling and identity.',
  portfolioUrls: [], profileStatus: 'DRAFT',
};
const artwork = {
  artworkId: 'artwork-test', title: 'Uyo Stories', slug: 'uyo-stories', discipline: 'DIGITAL_ART',
  description: 'A visual story about place, memory and everyday life in Uyo.', creationYear: 2026,
  origin: { place: 'Uyo' }, culturalContext: 'A contemporary interpretation of local visual identity.',
  tags: ['Uyo', 'visual art'], accessibilityText: 'Abstract layered shapes representing Uyo.',
  rights: { basis: 'ORIGINAL', rightsConfirmed: true, attributionText: 'Test Creator', thirdPartyPermissions: '', communityPermission: 'NOT_REQUIRED', displayLicense: 'ALL_RIGHTS_RESERVED' },
  contentNotice: { containsSensitiveCulturalMaterial: false, publicDisplayRestrictions: [] },
  media: [], status: 'DRAFT', reviewFeedback: [],
};
const publicArtwork = {
  artworkId: 'public-artwork-1', slug: 'uyo-stories', title: 'Uyo Stories', discipline: 'DIGITAL_ART',
  description: 'A published visual story from Uyo.', creationYear: 2026, origin: { place: 'Uyo' },
  culturalContext: 'A contemporary visual story.', tags: ['Uyo'], accessibilityText: 'Layered abstract shapes.',
  attribution: 'Test Creator', displayLicense: 'ALL_RIGHTS_RESERVED', media: [], publishedAt: '2026-11-01T10:00:00Z',
  creator: { slug: 'test-creator', displayName: 'Test Creator', location: creatorProfile.location },
};

export async function installApiMocks(page: Page, role: 'CUSTOMER' | 'BUSINESS_OWNER' | 'RECEPTION' | 'ADMIN' | null = null) {
  await page.route('**/api/**', async (route: Route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^\/api/, '');
    if (path === '/auth/session') return route.fulfill({ json: session(role) });
    if (path === '/auth/methods') return route.fulfill({ json: { data: { google: { enabled: false }, apple: { enabled: false }, passkeys: { enabled: false } } } });
    if (path === '/auth/passkeys') return route.fulfill({ json: { data: { passkeys: [] } } });
    if (path === '/auth/social/accounts') return route.fulfill({ json: { data: { accounts: [] } } });
    if (path === '/me/overview') return route.fulfill({ json: { data: { reservations: [], notifications: [] } } });
    if (['/business/overview', '/reception/overview', '/admin/overview'].includes(path)) return route.fulfill({ status: 503, json: { error: { code: 'SERVICE_UNAVAILABLE', message: 'Workspace data is unavailable in this isolated browser test.' } } });
    if (path === '/creator/profile') return route.fulfill({ json: { data: { creator: role ? creatorProfile : null } } });
    if (path === '/creator/artworks' || path === '/creator/artworks?limit=50') return route.fulfill({ json: { data: { items: role ? [{ artworkId: artwork.artworkId, title: artwork.title, discipline: artwork.discipline, status: artwork.status, updatedAt: '2026-11-01T10:00:00Z' }] : [], nextCursor: null } } });
    if (path === `/creator/artworks/${artwork.artworkId}`) return route.fulfill({ json: { data: { artwork } } });
    if (path === `/creator/artworks/${artwork.artworkId}/rights`) return route.fulfill({ json: { data: { evidence: [], communityPermissions: [], attributionReviews: [] } } });
    if (path === '/art-culture/artworks') return route.fulfill({ json: { data: { items: [publicArtwork], nextCursor: null } } });
    if (path === '/art-culture/creators/test-creator') return route.fulfill({ json: { data: { creator: { slug: 'test-creator', displayName: 'Test Creator', location: creatorProfile.location, disciplines: ['Digital art'], biography: creatorProfile.biography }, artworks: [publicArtwork] } } });
    if (path.startsWith('/art-culture/creators/')) return route.fulfill({ status: 404, json: { error: { code: 'NOT_FOUND', message: 'This creator profile is not public.' } } });
    return route.fulfill({ json: { data: {} } });
  });
}

