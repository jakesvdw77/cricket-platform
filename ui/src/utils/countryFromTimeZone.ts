import { COUNTRY_CODES, isoFromCountryName } from './countries'

// docs/specs/099-fields-directory.md: a small bundled lookup from an IANA time zone to an ISO country, for the Country
// default of the field form. It covers the cricket countries and the large zones; anything else falls back to the locale.
const ZONE_COUNTRY: Record<string, string> = {
  'Africa/Johannesburg': 'ZA',
  'Africa/Harare': 'ZW',
  'Africa/Windhoek': 'NA',
  'Africa/Gaborone': 'BW',
  'Africa/Maseru': 'LS',
  'Africa/Mbabane': 'SZ',
  'Africa/Maputo': 'MZ',
  'Africa/Lusaka': 'ZM',
  'Africa/Blantyre': 'MW',
  'Africa/Nairobi': 'KE',
  'Africa/Kampala': 'UG',
  'Africa/Dar_es_Salaam': 'TZ',
  'Africa/Lagos': 'NG',
  'Africa/Accra': 'GH',
  'Africa/Cairo': 'EG',
  'Africa/Casablanca': 'MA',
  'Africa/Algiers': 'DZ',
  'Africa/Tunis': 'TN',
  'Africa/Addis_Ababa': 'ET',
  'Africa/Luanda': 'AO',
  'Indian/Mauritius': 'MU',
  'Asia/Kolkata': 'IN',
  'Asia/Calcutta': 'IN',
  'Asia/Karachi': 'PK',
  'Asia/Dhaka': 'BD',
  'Asia/Colombo': 'LK',
  'Asia/Kathmandu': 'NP',
  'Asia/Kabul': 'AF',
  'Asia/Dubai': 'AE',
  'Asia/Muscat': 'OM',
  'Asia/Qatar': 'QA',
  'Asia/Riyadh': 'SA',
  'Asia/Kuwait': 'KW',
  'Asia/Bahrain': 'BH',
  'Asia/Singapore': 'SG',
  'Asia/Kuala_Lumpur': 'MY',
  'Asia/Hong_Kong': 'HK',
  'Asia/Tokyo': 'JP',
  'Asia/Seoul': 'KR',
  'Asia/Shanghai': 'CN',
  'Asia/Bangkok': 'TH',
  'Asia/Jakarta': 'ID',
  'Asia/Manila': 'PH',
  'Asia/Tehran': 'IR',
  'Asia/Jerusalem': 'IL',
  'Asia/Istanbul': 'TR',
  'Europe/London': 'GB',
  'Europe/Belfast': 'GB',
  'Europe/Dublin': 'IE',
  'Europe/Amsterdam': 'NL',
  'Europe/Brussels': 'BE',
  'Europe/Paris': 'FR',
  'Europe/Berlin': 'DE',
  'Europe/Madrid': 'ES',
  'Europe/Lisbon': 'PT',
  'Europe/Rome': 'IT',
  'Europe/Zurich': 'CH',
  'Europe/Vienna': 'AT',
  'Europe/Copenhagen': 'DK',
  'Europe/Stockholm': 'SE',
  'Europe/Oslo': 'NO',
  'Europe/Helsinki': 'FI',
  'Europe/Warsaw': 'PL',
  'Europe/Prague': 'CZ',
  'Europe/Athens': 'GR',
  'Europe/Moscow': 'RU',
  'Europe/Istanbul': 'TR',
  'Europe/Jersey': 'JE',
  'Europe/Guernsey': 'GG',
  'Europe/Isle_of_Man': 'IM',
  'Europe/Gibraltar': 'GI',
  'Australia/Sydney': 'AU',
  'Australia/Melbourne': 'AU',
  'Australia/Brisbane': 'AU',
  'Australia/Perth': 'AU',
  'Australia/Adelaide': 'AU',
  'Australia/Hobart': 'AU',
  'Australia/Darwin': 'AU',
  'Australia/Canberra': 'AU',
  'Pacific/Auckland': 'NZ',
  'Pacific/Fiji': 'FJ',
  'Pacific/Port_Moresby': 'PG',
  'Pacific/Apia': 'WS',
  'America/New_York': 'US',
  'America/Chicago': 'US',
  'America/Denver': 'US',
  'America/Los_Angeles': 'US',
  'America/Phoenix': 'US',
  'America/Anchorage': 'US',
  'Pacific/Honolulu': 'US',
  'America/Toronto': 'CA',
  'America/Vancouver': 'CA',
  'America/Edmonton': 'CA',
  'America/Winnipeg': 'CA',
  'America/Halifax': 'CA',
  'America/Mexico_City': 'MX',
  'America/Jamaica': 'JM',
  'America/Barbados': 'BB',
  'America/Port_of_Spain': 'TT',
  'America/Guyana': 'GY',
  'America/Antigua': 'AG',
  'America/St_Lucia': 'LC',
  'America/Grenada': 'GD',
  'America/St_Vincent': 'VC',
  'America/St_Kitts': 'KN',
  'America/Dominica': 'DM',
  'America/Nassau': 'BS',
  'America/Sao_Paulo': 'BR',
  'America/Argentina/Buenos_Aires': 'AR',
  'America/Santiago': 'CL',
  'America/Bogota': 'CO',
  'America/Lima': 'PE',
}

export function countryFromTimeZone(timeZone: string | null | undefined): string {
  return timeZone ? (ZONE_COUNTRY[timeZone] ?? '') : ''
}

// "en-ZA" -> "ZA", "en" -> ''.
export function countryFromLocale(locale: string | null | undefined): string {
  if (!locale) return ''
  const region = locale.split(/[-_]/).find((part, index) => index > 0 && /^[A-Za-z]{2}$/.test(part))
  const upper = region?.toUpperCase() ?? ''
  return COUNTRY_CODES.includes(upper) ? upper : ''
}

export interface DefaultCountryInput {
  timeZone?: string | null
  locale?: string | null
  // The club profile's country as free text (a name or a code).
  clubCountry?: string | null
}

// The Country a new field starts with, tried in this order: the browser's time zone, the locale's region, the club's own
// profile country, then empty. A default only; the manager can always change it.
export function defaultCountryCode({ timeZone, locale, clubCountry }: DefaultCountryInput): string {
  return countryFromTimeZone(timeZone) || countryFromLocale(locale) || isoFromCountryName(clubCountry) || ''
}

// Reads the browser's own time zone and locale (safe where Intl or navigator is missing).
export function browserDefaultCountry(clubCountry?: string | null): string {
  let timeZone: string | undefined
  try {
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    timeZone = undefined
  }
  const locale = typeof navigator === 'undefined' ? undefined : navigator.language
  return defaultCountryCode({ timeZone, locale, clubCountry })
}
