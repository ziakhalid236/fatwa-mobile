import { Share } from 'react-native';
import { API_BASE_URL } from '@/lib/store';

export const postLink = (postId: string) => `${API_BASE_URL}/p/${encodeURIComponent(postId)}`;

/** Extracts a post id from a shared link (https .../p/ID) or the app scheme (fatwa-mobile://post/ID). */
export function postIdFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = url.match(/(?:\/p\/|:\/\/post\/|\/post\/)([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

/** Shares a post as a link that opens inside the app (or a download page when the app is missing). */
export function sharePost(post: { id: string; title?: string; body?: string }): Promise<unknown> {
  const text = (post.title?.trim() || post.body?.trim() || 'Fatwa App').replace(/\s+/g, ' ').slice(0, 120);
  return Share.share({ message: `${text}\n\n${postLink(post.id)}` }).catch(() => undefined);
}
