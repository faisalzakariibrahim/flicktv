/**
 * FlickTV AI — XMLTV / EPG Parser
 */
import { parseStringPromise } from 'xml2js';

export async function parseXMLTV(xmlContent) {
  const result = await parseStringPromise(xmlContent, {
    explicitArray: false, ignoreAttrs: false,
  });

  const tv = result.tv;
  const channels = [];
  const programs = [];

  // Parse channels
  const rawChannels = Array.isArray(tv.channel) ? tv.channel : [tv.channel].filter(Boolean);
  for (const ch of rawChannels) {
    channels.push({
      tvg_id: ch.$.id,
      display_name: Array.isArray(ch['display-name'])
        ? ch['display-name'][0]?._ || ch['display-name'][0]
        : ch['display-name']?._ || ch['display-name'],
      icon_url: ch.icon?.$?.src || null,
    });
  }

  // Parse programs
  const rawPrograms = Array.isArray(tv.programme) ? tv.programme : [tv.programme].filter(Boolean);
  for (const prog of rawPrograms.slice(0, 5000)) {
    if (!prog?.$) continue;
    programs.push({
      channel_tvg_id: prog.$.channel,
      title: prog.title?._ || prog.title || 'Unknown',
      description: prog.desc?._ || prog.desc || null,
      start_time: parseXMLTVDate(prog.$.start),
      end_time: parseXMLTVDate(prog.$.stop),
      category: prog.category?._ || prog.category || null,
      rating: prog.rating?.value || null,
    });
  }

  return { channels, programs };
}

function parseXMLTVDate(str) {
  if (!str) return null;
  // Format: 20250101120000 +0000
  const match = str.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\s*([+-]\d{4})?/);
  if (!match) return null;
  const [, y, mo, d, h, mi, s] = match;
  return new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}Z`);
}
