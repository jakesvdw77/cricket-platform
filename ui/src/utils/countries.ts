// docs/specs/099-fields-directory.md: the ISO 3166-1 alpha-2 country list a field's address uses. Only the codes are
// bundled; the names come from the browser's own Intl.DisplayNames (English), falling back to the bare code.
const ISO_CODES =
  'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ ' +
  'CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR ' +
  'GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP ' +
  'KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT ' +
  'MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW ' +
  'SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG ' +
  'UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'

export const COUNTRY_CODES: readonly string[] = ISO_CODES.split(' ')

export interface CountryOption {
  code: string
  name: string
}

let displayNames: Intl.DisplayNames | null | undefined

function regionNames(): Intl.DisplayNames | null {
  if (displayNames === undefined) {
    try {
      displayNames = new Intl.DisplayNames(['en'], { type: 'region' })
    } catch {
      displayNames = null
    }
  }
  return displayNames
}

// The English name of a country code ("ZA" -> "South Africa"); an unknown or empty code is shown as it is.
export function countryName(code: string | null | undefined): string {
  if (!code) return ''
  const upper = code.trim().toUpperCase()
  try {
    const name = regionNames()?.of(upper)
    return name && name !== upper ? name : upper
  } catch {
    return upper
  }
}

let options: CountryOption[] | null = null

// Every country, by name.
export function countryOptions(): CountryOption[] {
  if (!options) {
    options = COUNTRY_CODES.map((code) => ({ code, name: countryName(code) })).sort((a, b) => a.name.localeCompare(b.name))
  }
  return options
}

// Names a club profile might hold as free text that Intl does not use.
const COUNTRY_ALIASES: Record<string, string> = {
  uk: 'GB',
  'u.k.': 'GB',
  'great britain': 'GB',
  britain: 'GB',
  england: 'GB',
  scotland: 'GB',
  wales: 'GB',
  'northern ireland': 'GB',
  usa: 'US',
  'u.s.a.': 'US',
  'united states of america': 'US',
  america: 'US',
  rsa: 'ZA',
  'republic of south africa': 'ZA',
  uae: 'AE',
  holland: 'NL',
}

// The club profile keeps its country as free text. Maps that to an ISO code when it is a code already, a country name
// or a common alias; '' when it cannot be told.
export function isoFromCountryName(value: string | null | undefined): string {
  const text = (value ?? '').trim()
  if (!text) return ''
  const upper = text.toUpperCase()
  if (upper.length === 2 && COUNTRY_CODES.includes(upper)) return upper
  const lower = text.toLowerCase()
  if (COUNTRY_ALIASES[lower]) return COUNTRY_ALIASES[lower]
  return countryOptions().find((option) => option.name.toLowerCase() === lower)?.code ?? ''
}

// The label of the region level of an address, by country: "Province" for South Africa, "County" for the UK and
// Ireland, "State" for the US, Australia and India, otherwise the neutral "Province/County/State".
const PROVINCE_LABELS: Record<string, string> = {
  ZA: 'Province',
  GB: 'County',
  IE: 'County',
  US: 'State',
  AU: 'State',
  IN: 'State',
}

export const DEFAULT_PROVINCE_LABEL = 'Province/County/State'

export function provinceLabel(countryCode: string | null | undefined): string {
  return PROVINCE_LABELS[(countryCode ?? '').toUpperCase()] ?? DEFAULT_PROVINCE_LABEL
}
