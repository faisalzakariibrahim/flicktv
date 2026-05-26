import { parseString } from 'xml2js';
import { promisify } from 'util';

const parseXml = promisify(parseString);

/**
 * Parse XMLTV EPG data into structured program objects.
 * @param {string} xmlContent - Raw XMLTV XML string
 * @returns {{ channels: Array, programs: Array }}
 */
export async function parseXMLTV(xmlContent) {
  let parsed;
  try {
    parsed = await parseXml(xmlContent, {
      explicitArray: false,
      mergeAttrs: true,
      trim: true,
    });
  } catch (err) {
    throw new Error(`Invalid XMLTV format: ${err.message}`);
  }

  const tv = parsed?.tv;
  if (!tv) throw new Error('Missing <tv> root element in XMLTV');

  const rawChannels = Array.isArray(tv.channel) ? tv.channel : tv.channel ? [tv.channel] : [];
  const rawPrograms = Array.isArray(tv.programme) ? tv.programme : tv.programme ? [tv.programme] : [];

  const channels = rawChannels.map(ch => ({
    tvg_id: ch.id,
    display_name: extractText(ch['display-name']),
    icon: ch.icon?.src || null,
  }));

  const programs = rawPrograms.map(prog => ({
    channel_tvg_id: prog.channel,
    title: extractText(prog.title),
    description: extractText(prog.desc) || null,
    start_time: parseXmltvDate(prog.start),
    end_time: parseXmltvDate(prog.stop),
    category: extractText(prog.category) || null,
    poster_url: prog.icon?.src || null,
    rating: prog.rating?.value || null,
  })).filter(p => p.start_time && p.end_time);

  return { channels, programs };
}

function extractText(val) {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'object') return val._ || val.$?._ || Object.values(val)[0] || '';
  return String(val);
}

// XMLTV date format: 20240115120000 +0000
function parseXmltvDate(str) {
  if (!str) return null;
  const clean = str.replace(/\s.*/, ''); // strip timezone suffix
  const [, Y, M, D, h, m, s] = clean.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/) || [];
  if (!Y) return null;
  return new Date(`${Y}-${M}-${D}T${h}:${m}:${s}Z`).toISOString();
}
