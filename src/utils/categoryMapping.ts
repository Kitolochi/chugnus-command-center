export interface SpendingCategory {
  name: string
  color: string      // Tailwind accent color name
  colorHex: string   // Hex for SVG rendering
  keywords: string[]
}

export const SPENDING_CATEGORIES: Record<string, SpendingCategory> = {
  food: {
    name: 'Food & Dining',
    color: 'accent-orange',
    colorHex: '#FB923C',
    keywords: [
      'restaurant', 'mcdonald', 'burger', 'pizza', 'starbucks', 'dunkin',
      'chipotle', 'chick-fil-a', 'wendy', 'taco bell', 'subway', 'panera',
      'doordash', 'grubhub', 'uber eats', 'ubereats', 'postmates',
      'domino', 'papa john', 'wingstop', 'popeye', 'sonic', 'arby',
      'ihop', 'denny', 'waffle house', 'cracker barrel', 'olive garden',
      'applebee', 'chili', 'outback', 'red lobster', 'buffalo wild',
      'five guys', 'in-n-out', 'jack in the box', 'whataburger',
      'groceries', 'grocery', 'whole foods', 'trader joe', 'aldi',
      'kroger', 'publix', 'safeway', 'food lion', 'harris teeter',
      'wegmans', 'sprouts', 'instacart', 'fresh market',
    ],
  },
  shopping: {
    name: 'Shopping',
    color: 'accent-purple',
    colorHex: '#A78BFA',
    keywords: [
      'amazon', 'walmart', 'target', 'costco', 'sam\'s club', 'best buy',
      'home depot', 'lowe', 'ikea', 'wayfair', 'etsy', 'ebay',
      'nordstrom', 'macy', 'tj maxx', 'marshalls', 'ross', 'kohls',
      'old navy', 'gap', 'nike', 'adidas', 'zappos', 'chewy',
      'bath & body', 'sephora', 'ulta', 'dollar tree', 'dollar general',
      'walgreens', 'cvs', 'rite aid', 'five below',
    ],
  },
  gas: {
    name: 'Gas & Fuel',
    color: 'accent-amber',
    colorHex: '#FBBF24',
    keywords: [
      'shell', 'exxon', 'chevron', 'bp ', 'sunoco', 'marathon',
      'speedway', 'circle k', 'wawa', 'sheetz', 'racetrac', 'murphy',
      'quiktrip', 'pilot', 'loves travel', 'gas', 'fuel', 'petroleum',
      'citgo', 'phillips 66', 'valero', 'conoco',
    ],
  },
  subscriptions: {
    name: 'Subscriptions',
    color: 'accent-blue',
    colorHex: '#6C8EEF',
    keywords: [
      'netflix', 'spotify', 'hulu', 'disney+', 'disney plus', 'hbo',
      'apple.com/bill', 'apple music', 'icloud', 'google storage',
      'youtube premium', 'amazon prime', 'audible', 'kindle',
      'adobe', 'microsoft 365', 'office 365', 'dropbox', 'notion',
      'chatgpt', 'openai', 'anthropic', 'claude', 'github',
      'paramount', 'peacock', 'crunchyroll', 'playstation', 'xbox',
      'subscription', 'monthly', 'recurring',
    ],
  },
  entertainment: {
    name: 'Entertainment',
    color: 'accent-rose',
    colorHex: '#F472B6',
    keywords: [
      'amc', 'regal', 'cinemark', 'movie', 'theater', 'theatre',
      'concert', 'ticketmaster', 'stubhub', 'live nation', 'eventbrite',
      'steam', 'playstation', 'nintendo', 'epic games', 'twitch',
      'bowling', 'arcade', 'dave & buster', 'topgolf', 'zoo',
      'museum', 'aquarium', 'amusement', 'theme park',
    ],
  },
  transport: {
    name: 'Transportation',
    color: 'accent-teal',
    colorHex: '#2DD4BF',
    keywords: [
      'uber', 'lyft', 'taxi', 'cab ', 'parking', 'toll',
      'transit', 'metro', 'subway', 'bus ', 'amtrak', 'train',
      'airline', 'delta', 'united', 'american air', 'southwest',
      'jetblue', 'frontier', 'spirit air', 'flight',
    ],
  },
  utilities: {
    name: 'Utilities',
    color: 'accent-emerald',
    colorHex: '#34D399',
    keywords: [
      'electric', 'power', 'energy', 'duke energy', 'dominion',
      'water', 'sewer', 'gas bill', 'natural gas', 'atmos', 'piedmontng', 'piedmont natural',
      'internet', 'comcast', 'xfinity', 'att', 'at&t', 'verizon',
      'spectrum', 'tmobile', 't-mobile', 'sprint', 'mint mobile',
      'phone bill', 'wireless', 'broadband', 'fiber',
      'trash', 'waste', 'recycling',
    ],
  },
  housing: {
    name: 'Housing',
    color: 'accent-blue',
    colorHex: '#5B7BD5',
    keywords: [
      'rent', 'mortgage', 'hoa', 'property tax', 'home insurance',
      'landlord', 'apartment', 'lease', 'housing', 'realtor',
    ],
  },
  health: {
    name: 'Health & Medical',
    color: 'accent-red',
    colorHex: '#F87171',
    keywords: [
      'pharmacy', 'doctor', 'hospital', 'clinic', 'medical',
      'dental', 'dentist', 'optom', 'vision', 'eye care',
      'urgent care', 'labcorp', 'quest diag', 'copay',
      'prescription', 'therapy', 'counseling', 'mental health',
      'gym', 'fitness', 'planet fitness', 'ymca', 'peloton',
      'chiroprac', 'thorne research', 'cornerstone ent',
    ],
  },
  insurance: {
    name: 'Insurance',
    color: 'accent-amber',
    colorHex: '#D4A017',
    keywords: [
      'insurance', 'geico', 'state farm', 'allstate', 'progressive',
      'usaa', 'liberty mutual', 'nationwide', 'farmers',
      'life insurance', 'health insurance', 'auto insurance',
      'premium', 'deductible',
    ],
  },
  income: {
    name: 'Income',
    color: 'accent-emerald',
    colorHex: '#34D399',
    keywords: [
      'payroll', 'direct dep', 'salary', 'wage', 'paycheck',
      'ach credit', 'employer', 'income', 'commission', 'bonus',
      'refund', 'tax refund', 'reimbursement', 'cashback', 'cash back',
      'interest paid', 'dividend', 'venmo credit', 'zelle from',
    ],
  },
  transfer: {
    name: 'Transfer',
    color: 'accent-teal',
    colorHex: '#7DD4BF',
    keywords: [
      'transfer', 'zelle', 'venmo', 'paypal', 'cash app',
      'wire', 'ach', 'payment from', 'payment to', 'autopay',
      'balance transfer', 'credit card payment', 'payment thank you',
      'online payment', 'bill pay', 'pymt', 'auto pay',
      'loan payment', 'mortgage payment',
      'discover dc pymnts', 'discover pymt', 'discover payment',
      'capital one online pmt', 'capital one mobile pmt',
      'amex epayment', 'chase epay', 'citi autopay',
    ],
  },
  other: {
    name: 'Other',
    color: 'accent-purple',
    colorHex: '#8B7FCC',
    keywords: [],
  },
}

export function categorizeTransaction(
  description: string,
  merchant: string | undefined,
  amount: number,
  existingCategory?: string,
): string {
  // If already has a provider category that matches ours, keep it
  if (existingCategory) {
    const lower = existingCategory.toLowerCase()
    for (const [key, cat] of Object.entries(SPENDING_CATEGORIES)) {
      if (lower === key || lower === cat.name.toLowerCase()) return key
    }
  }

  const text = `${merchant || ''} ${description}`.toLowerCase()

  // Check each category's keywords
  for (const [key, cat] of Object.entries(SPENDING_CATEGORIES)) {
    if (key === 'other' || key === 'income') continue
    for (const kw of cat.keywords) {
      if (text.includes(kw)) return key
    }
  }

  // Positive amounts (credits) default to income
  if (amount > 0) return 'income'

  return 'other'
}

export function getCategoryInfo(key: string): SpendingCategory {
  return SPENDING_CATEGORIES[key] || SPENDING_CATEGORIES.other
}

/**
 * Normalize a transaction amount so that spending is always negative and income
 * is always positive, regardless of account type.
 *
 * Credit card accounts have inverted signs from Teller:
 *   - Purchases are positive (increases balance/debt) → should be negative (spending)
 *   - Payments are negative (decreases debt) → should be positive (income/transfer)
 *
 * Depository accounts (checking/savings) already use the standard convention.
 */
export type AccountType = 'checking' | 'savings' | 'credit_card' | 'loan' | 'mortgage' | 'investment' | 'other'

export function normalizeAmount(amount: number, accountType?: AccountType): number {
  if (accountType === 'credit_card' || accountType === 'loan' || accountType === 'mortgage') {
    return -amount  // Flip sign: positive purchase → negative spending
  }
  return amount
}
