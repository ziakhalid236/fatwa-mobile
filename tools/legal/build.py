#!/usr/bin/env python3
"""Single source for the legal pages. Run: python3 tools/legal/build.py
Writes the in-app copy (artifacts/fatwa-mobile/data/legal.ts) and the hosted pages (artifacts/admin-panel/public/*.html)."""
import json, html, os
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
UPDATED = 'October 30, 2026'
CONTACT = 'the support email shown on the app store listing'

PAGES = [
 ('terms', 'Terms of Use', 'terms.html', 'The rules for using the Fatwa app.', [
  ('Acceptance', ['By installing or using the Fatwa app you agree to these terms. If you do not agree, please do not use the app.']),
  ('What the app is', ['Fatwa provides prayer times, Qibla direction, a library of Islamic texts, an AI assistant, and a moderated community feed of reminders. It is an educational and informational tool.']),
  ('Not a fatwa authority', ['Nothing in the app is a binding fatwa or a substitute for a qualified mufti or scholar. For personal rulings, family matters, finance, inheritance, or anything with serious consequences, consult a qualified scholar in person.']),
  ('Your account', ['You can use most features without an account. To post, you create a simple profile (name, country, city, optional picture). You are responsible for the information you provide and for activity on your device.']),
  ('Your content', ['You keep ownership of what you post. You give us permission to review, display, translate, and distribute your approved posts inside the app and to send notifications about them. Posts are removed automatically 30 days after publication.', 'Do not post content that is unlawful, hateful, abusive, misleading, sectarian-inciting, sexually explicit, or that infringes anyone else’s rights. See the Community Guidelines.']),
  ('Moderation', ['Every post is reviewed before it appears. We may reject, edit the presentation of, or remove content, and may block accounts that abuse the service, without notice.']),
  ('Library texts', ['Library texts are shown with their source and license. Some texts are published under licenses that allow non-commercial use only. Where a text’s rights are not confirmed, the app says so. You may not copy the library in bulk or resell it.']),
  ('Availability', ['The service is provided “as is”. We may change, suspend, or end features at any time. We are not liable for losses arising from reliance on the app, to the extent allowed by law.']),
  ('Changes', [f'We may update these terms. The date at the top shows the latest version. Continued use means you accept the update.']),
  ('Contact', [f'Questions: use {CONTACT}.']),
 ]),
 ('privacy', 'Privacy Policy', 'privacy-policy.html', 'What data the app uses and why.', [
  ('Summary', ['We collect only what the app needs. We do not sell your data and we do not show advertising.']),
  ('Information we use', [
    'Location (only if you allow it, and only while the app is open): to calculate prayer times and Qibla, to suggest your city and country, and to show nearby posts first. You can refuse and enter your city manually.',
    'Profile: the name, country, city and optional picture you provide. Your name, picture and city are shown on posts you publish.',
    'Posts and images you submit, and the questions you type to the AI assistant.',
    'A random device identifier and a session token, so the app can remember your profile and sync notifications.',
    'A push-notification token from Google Firebase Cloud Messaging, if you allow notifications, so we can send alerts about new posts and answers.',
    'Basic technical logs (IP address, request time) created by our hosting provider for security and abuse prevention.']),
  ('How we use it', ['To run the features above, to review posts, to send notifications you have allowed, to prevent abuse, and to keep the service reliable.']),
  ('AI assistant', ['Your question is sent to an AI model hosted by Cloudflare Workers AI, together with passages found in the library, to produce an answer. Please do not put sensitive personal details in questions. Answers can be wrong; see the Content & AI Disclaimer.']),
  ('Who processes data', ['Cloudflare (hosting, database, image storage, AI), Google Firebase Cloud Messaging (push delivery), and your device’s map/geocoding service for location names. These providers process data only to deliver the service.']),
  ('Retention', ['Published posts, their images, likes and notification records are deleted automatically 30 days after publication or earlier. Rejected or pending submissions are kept briefly for moderation. Profile data is kept until you ask us to delete it.']),
  ('Your choices and deletion', ['You can deny location or notification permissions in your device settings, turn off post alerts in the app, and request deletion of your profile and posts at any time. See the Data Deletion page.']),
  ('Children', ['The app is not directed at children under 13 and we do not knowingly collect their data.']),
  ('Security', ['Data is encrypted in transit. Administration is restricted. No online service is perfectly secure.']),
  ('Contact', [f'For privacy questions or deletion requests use {CONTACT}.']),
 ]),
 ('disclaimer', 'Content & AI Disclaimer', 'disclaimer.html', 'How to treat answers and texts in the app.', [
  ('Educational use only', ['The AI assistant, the library and the community feed are for learning. They are not fatwas.']),
  ('The AI can be wrong', ['The assistant answers from retrieved passages and general knowledge. It may misread a source, miss context, or be wrong on details of fiqh. Always check the cited source and ask a qualified mufti for personal rulings.']),
  ('School of thought', ['Retrieved books lean on classical Hanafi texts, but the library also contains general sources (Quran, hadith collections). Not every passage has been reviewed by a scholar. Each text is labelled with its review status.']),
  ('Translations', ['Urdu and English translations belong to their translators. Where rights are unconfirmed the app marks them “Translation rights unverified”.']),
  ('Report a mistake', [f'If you see an error in a text or an answer, tell us through {CONTACT}.']),
 ]),
 ('guidelines', 'Community Guidelines', 'community-guidelines.html', 'What is allowed in community posts.', [
  ('Be sincere and respectful', ['Share short reminders, verses, hadith or useful reflections. Cite your source when quoting.']),
  ('Not allowed', ['Insults, hate or incitement against any person or group; takfir and sectarian attacks; unverified or fabricated hadith; political propaganda; advertising and spam; private information about others; sexual or violent content; copyrighted material you do not have the right to share.']),
  ('Review process', ['Posts are reviewed by moderators before publishing. Published posts disappear after 30 days.']),
  ('Reporting', [f'To report a post, use {CONTACT}. We aim to review reports promptly.']),
 ]),
 ('deletion', 'Data Deletion', 'data-deletion.html', 'How to delete your data.', [
  ('Delete your data', [f'Send a deletion request using {CONTACT}, from the device or with the profile name you used. We delete your profile, picture, posts, likes, notifications and push token.']),
  ('What is deleted automatically', ['Published posts and their images are removed 30 days after publication. Old notifications and rate-limit records are cleaned up daily.']),
  ('On your device', ['Uninstalling the app removes locally stored settings, saved posts and alarms.']),
 ]),
 ('credits', 'Sources & Credits', 'sources.html', 'Where the library texts come from.', [
  ('Quran', ['Arabic text and translations through Tanzil / alquran.cloud (free to use unmodified, with attribution). Urdu: Fateh Muhammad Jalandhry. English: Sahih International.']),
  ('Hadith', ['Hadith collections and translations through the open Hadith API project (fawazahmed0). Arabic texts are classical; Urdu and English translations belong to their translators and their rights are marked unverified.']),
  ('Classical Hanafi books', ['Texts from the OpenITI corpus, released under CC BY-NC-SA 4.0 (attribution, non-commercial, share-alike). Text quality varies because it is machine converted.']),
  ('Fatwa archives', ['Fatwa archives from public institutions are linked to their original pages for attribution.']),
 ]),
]

CSS = "body{font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:760px;margin:0 auto;padding:32px 20px;color:#17352d;line-height:1.65;background:#fffdf8}h1,h2{color:#07563f}h2{margin-top:28px;font-size:19px}small{color:#61756e}nav{margin:18px 0;font-size:14px}nav a{color:#07563f;margin-right:14px}"

def page(i):
    key, title, fname, _, sections = PAGES[i]
    nav = ' '.join(f'<a href="/{p[2]}">{html.escape(p[1])}</a>' for p in PAGES)
    body = ''.join(f'<h2>{html.escape(h)}</h2>' + ''.join(f'<p>{html.escape(t)}</p>' for t in ps) for h, ps in sections)
    return f'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Fatwa App — {html.escape(title)}</title><style>{CSS}</style></head><body><h1>{html.escape(title)}</h1><small>Last updated: {UPDATED}</small>{body}<nav>{nav}</nav></body></html>'

pub = os.path.join(ROOT, 'artifacts/admin-panel/public')
for i, p in enumerate(PAGES): open(os.path.join(pub, p[2]), 'w').write(page(i))
data = [{'key': k, 'title': t, 'subtitle': s, 'url': '/' + f, 'sections': [{'heading': h, 'paragraphs': ps} for h, ps in secs]} for k, t, f, s, secs in PAGES]
ts = f"// Generated by tools/legal/build.py — edit that file, not this one.\nexport const LEGAL_UPDATED = '{UPDATED}';\nexport type LegalPage = {{ key: string; title: string; subtitle: string; url: string; sections: Array<{{ heading: string; paragraphs: string[] }}> }};\nexport const LEGAL_PAGES: LegalPage[] = {json.dumps(data, ensure_ascii=False, indent=2)};\n"
open(os.path.join(ROOT, 'artifacts/fatwa-mobile/data/legal.ts'), 'w').write(ts)
print('ok', len(PAGES))
