const fs = require('fs');
const dbPath = process.env.APPDATA + '/mega-agenda/mega-agenda.json';
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
const goal = db.roadmapGoals.find(g => g.id === 'mlvbxouqzi1tpb');

if (!goal) { console.log('Goal not found'); process.exit(1); }

// Restore the original research questions
goal.research_questions = [
  'First-year baby costs and budgeting breakdown',
  'Health insurance changes needed after birth',
  'Tax benefits and credits for new parents (2026)',
  'Life insurance and estate planning for new parents',
  'Emergency fund targets with a newborn',
  'Parental leave options (FMLA, state, employer)',
  'Choosing a pediatrician - what to look for',
  'Vaccination schedule for first year',
  'Newborn health warning signs to watch for',
  'Postpartum depression signs and support resources',
  'Safe sleep guidelines (AAP recommendations)',
  'Essential baby gear checklist - what to actually buy vs skip',
  'Nursery setup and safety requirements',
  'Baby-proofing the home room by room',
  'Hospital bag packing checklist',
  'Daycare vs nanny vs family care - costs and tradeoffs',
  'Daycare waitlists - when and how to get on them',
  'Returning to work after baby - planning timeline',
  'Breastfeeding basics and support resources',
  'Newborn sleep patterns and strategies',
];

goal.guidance_needed = [
  'How to prepare relationship for parenthood',
  'How to set up night duty shifts between parents',
  'How to handle visitor boundaries with family',
  'How to choose a parenting philosophy',
  'Best parenting books to read before birth',
  'How to meal prep and batch cook before baby arrives',
  'How to create a birth plan',
  'How to prepare older pets for a baby',
  'How to build a support network before baby',
  'How to manage career and parenthood',
  'How to handle unsolicited parenting advice',
  'How to prepare mentally and emotionally for parenthood',
  'How to document and track baby milestones',
];

const now = new Date().toISOString();

// Save our existing research as topic reports
goal.topicReports = [
  {
    topic: 'First-year baby costs and budgeting breakdown',
    type: 'question',
    generatedAt: now,
    report: `First-Year Costs Summary:

Childcare (daycare): $800-$2,400/month ($9,600-$28,800/year)
Diapers + wipes: $70-$100/month ($840-$1,200/year)
Formula (if applicable): $400-$800/month ($4,800-$9,600/year)
Clothing: $50-$100/month ($600-$1,200/year)
Baby gear (one-time): $2,000-$4,550
Healthcare copays: $500-$2,000/year

Total without childcare: $4,800-$9,600/year
Total with daycare: $14,400-$38,400/year`
  },
  {
    topic: 'Health insurance changes needed after birth',
    type: 'question',
    generatedAt: now,
    report: `60-day window after birth to add baby to health insurance (retroactive to birth date). 30-day window to adjust Dependent Care FSA (qualifying life event). SSN arrives 2-4 weeks after birth via Enumeration at Birth. No SSN needed to START insurance enrollment. Confirm pediatrician is in-network before birth. Get premium quote for adding dependent.`
  },
  {
    topic: 'Tax benefits and credits for new parents (2026)',
    type: 'question',
    generatedAt: now,
    report: `Child Tax Credit: $2,200 direct credit
Dependent Care FSA ($7,500 at ~30%): ~$2,224 savings
Healthcare FSA ($3,300 at ~30%): ~$990 savings
W-4 adjustment (increased take-home): ~$183/month
Total annual tax benefit: $5,400-$6,500+

Update W-4 immediately after birth to increase take-home pay.`
  },
  {
    topic: 'Life insurance and estate planning for new parents',
    type: 'question',
    generatedAt: now,
    report: `Apply for term life insurance ASAP - underwriting takes 4-8 weeks. $1M 30-year term for a 30yo costs ~$55-65/month. Both parents need coverage. Draft a will with guardian designation - Online: $299-599 (Trust & Will), Attorney: $1,000-2,500. Name a guardian AND a backup.`
  },
  {
    topic: 'Emergency fund targets with a newborn',
    type: 'question',
    generatedAt: now,
    report: `Target $20K-$33K (3-6 months of post-baby expenses). Calculate your new monthly expenses including childcare, diapers, formula, and increased healthcare costs. Keep funds in high-yield savings account for immediate access.`
  },
  {
    topic: 'Parental leave options (FMLA, state, employer)',
    type: 'question',
    generatedAt: now,
    report: `FMLA: 12 weeks unpaid, job-protected leave if employer has 50+ employees. Confirm eligibility with HR. 16 states + DC have paid family leave programs. Submit parental leave paperwork 30 days before due date. Check PUMP Act accommodations for private non-bathroom lactation space at work.`
  },
  {
    topic: 'Choosing a pediatrician - what to look for',
    type: 'question',
    generatedAt: now,
    report: `Start searching now and schedule prenatal consultation visits. Need one selected by April. They see baby within 24-48 hours after birth. Check: in-network with insurance, office hours and after-hours availability, hospital affiliation, communication style, vaccination philosophy. Provide their info to delivery hospital before birth.`
  },
  {
    topic: 'Vaccination schedule for first year',
    type: 'question',
    generatedAt: now,
    report: `Birth: Hep B dose 1
2 months: DTaP, Hib, IPV, PCV, Rotavirus, Hep B dose 2
4 months: DTaP, Hib, IPV, PCV, Rotavirus
6 months: DTaP, Hib, PCV, Hep B dose 3, Flu (first dose)
12 months: MMR, Varicella, Hep A`
  },
  {
    topic: 'Newborn health warning signs to watch for',
    type: 'question',
    generatedAt: now,
    report: `Red Flags - Contact Pediatrician Immediately:
- Loss of previously acquired skills at any age
- No social smiling by 4 months
- Does not respond to name by 9 months
- No single words by 12 months
- Does not point by 12 months
- Fever over 100.4F in baby under 3 months (go to ER)
- Difficulty breathing, blue lips, persistent vomiting
- Not wetting diapers (dehydration)
- Unusual lethargy or inconsolable crying

Save Poison Control: 1-800-222-1222`
  },
  {
    topic: 'Postpartum depression signs and support resources',
    type: 'question',
    generatedAt: now,
    report: `Affects 1 in 7 mothers, 1 in 10 fathers. Both parents should learn signs. Identify a perinatal therapist NOW before birth.

Signs: persistent sadness, anxiety, difficulty bonding, withdrawal, changes in appetite/sleep beyond normal newborn exhaustion, intrusive thoughts.

Resources:
- Postpartum Support International: 1-800-944-4773
- Suicide & Crisis Lifeline: 988
- Crisis Text Line: Text HELP to 741741`
  },
  {
    topic: 'Safe sleep guidelines (AAP recommendations)',
    type: 'question',
    generatedAt: now,
    report: `Back sleeping EVERY time. Firm, flat mattress with fitted sheet ONLY. Nothing else in the crib - no blankets, pillows, bumpers, toys, weighted swaddles. Room sharing (not bed sharing) for 6-12 months - reduces SIDS risk by 50%. Pacifier at sleep time - associated with reduced SIDS. Stop swaddling at first sign of rolling (typically 3-4 months).`
  },
  {
    topic: 'Essential baby gear checklist - what to actually buy vs skip',
    type: 'question',
    generatedAt: now,
    report: `Must Buy:
- Car seat: $150-350 (buy NEW only)
- Crib + firm mattress: $100-300
- Diapers (NB + Size 1): $50-80 to start
- 6-8 onesies, 4-6 sleepers (mostly 0-3 month): $50-100
- 3-4 swaddles: $30-60
- 4-6 bottles: $20-40
- Sound machine: $25-70 (Hatch Rest $70 or Dreamegg $25)
- Breast pump: $0 through insurance

Skip Entirely:
- Wipe warmer, bottle warmer, baby shoes, dedicated changing table
- Excessive newborn-size clothes (outgrow in 1-2 weeks)
- Video monitor with breathing tracking (creates anxiety, not proven to prevent SIDS)
- Baby laundry detergent (Tide Free & Gentle works fine)`
  },
  {
    topic: 'Hospital bag packing checklist',
    type: 'question',
    generatedAt: now,
    report: `Pack by week 35. Extra-long phone charger, going-home outfits in BOTH newborn and 0-3 sizes. Toiletries, comfortable clothes, nursing bra, snacks, insurance card, birth plan copies (3). Car seat must be installed before you can leave the hospital.`
  },
  {
    topic: 'Daycare vs nanny vs family care - costs and tradeoffs',
    type: 'question',
    generatedAt: now,
    report: `Daycare center: $800-$2,400/month. Structured, regulated, socialization. Less flexibility on hours/sick days.
In-home daycare: $600-$1,500/month. Smaller groups, more personal.
Nanny: $2,500-$4,000+/month. Most flexible, one-on-one care, but most expensive.
Family care: Free/low cost but can strain relationships. Set clear expectations.

Key: Get on daycare waitlists NOW. Infant care waitlists are 6-18 months. At 4 months out you're already behind.`
  },
  {
    topic: 'Daycare waitlists - when and how to get on them',
    type: 'question',
    generatedAt: now,
    report: `Call 5+ centers TODAY. Infant care waitlists are 6-18 months long. At 4 months out you are already behind. Visit centers, check licensing, ask about infant-to-caregiver ratios (should be 1:3 or 1:4 for infants), check reviews, ask about sick policies.`
  },
  {
    topic: 'Returning to work after baby - planning timeline',
    type: 'question',
    generatedAt: now,
    report: `Confirm FMLA eligibility with HR (12 weeks unpaid if employer has 50+ employees). Check state paid family leave (16 states + DC). Submit parental leave paperwork 30 days before due date. Confirm PUMP Act accommodations (private non-bathroom lactation space). Plan childcare start date to align with return. Consider gradual return (part-time first week).`
  },
  {
    topic: 'Breastfeeding basics and support resources',
    type: 'question',
    generatedAt: now,
    report: `Sign up for breastfeeding class (many hospitals offer free). Order breast pump through insurance (ACA covers one at no cost - call insurer). Identify a lactation consultant before birth. Common challenges: latch issues, supply concerns, pain. Support: La Leche League, hospital lactation services.`
  },
  {
    topic: 'Newborn sleep patterns and strategies',
    type: 'question',
    generatedAt: now,
    report: `Newborns sleep 16-17 hours/day in 2-3 hour stretches. No consistent schedule until 3-4 months. Follow safe sleep guidelines. Use swaddling (stop at first roll sign ~3-4 months). White noise helps. Learn the 5 S's from Happiest Baby on the Block: Swaddle, Side/Stomach (for soothing, NOT sleeping), Shush, Swing, Suck.`
  },
  {
    topic: 'How to prepare relationship for parenthood',
    type: 'guidance',
    generatedAt: now,
    report: `Weekly 20-minute check-in (start the habit NOW before baby). Each partner gets 2-3 hours/week of solo time (non-negotiable). Agree on a "tag out" safe phrase for when either parent is at their limit. 67% of couples see relationship satisfaction decline after baby - couples who discuss roles beforehand fare much better. Read "And Baby Makes Three" by John Gottman.`
  },
  {
    topic: 'How to set up night duty shifts between parents',
    type: 'guidance',
    generatedAt: now,
    report: `Split the night into shifts (e.g., 9PM-2AM and 2AM-7AM). Off-duty parent sleeps in a separate room with earplugs + white noise. One 4-5 hour uninterrupted block is far more restorative than fragmented sleep. If breastfeeding: non-nursing parent handles all non-feeding tasks (diaper changes, soothing, bringing baby to nursing parent).`
  },
  {
    topic: 'How to handle visitor boundaries with family',
    type: 'guidance',
    generatedAt: now,
    report: `No visitors first 1-2 weeks. All visitors: current Tdap, flu shot, no symptoms in 72 hours. Visits limited to 30-60 minutes. Helpful visitors do dishes/laundry, not just hold the baby. No social media photos without permission. Designate a "gatekeeper" to manage requests.`
  },
  {
    topic: 'How to choose a parenting philosophy',
    type: 'guidance',
    generatedAt: now,
    report: `Evidence-based blend works best:
1. Responsive, sensitive caregiving (Attachment) - builds secure attachment
2. Respectful observation (RIE) - understand your specific child's needs
3. Prepared environment + independence (Montessori) - supports development
4. Kind AND firm boundaries (Positive Discipline) - structure with connection
5. Warmth + structure (Authoritative) - deepest evidence base overall`
  },
  {
    topic: 'Best parenting books to read before birth',
    type: 'guidance',
    generatedAt: now,
    report: `1. And Baby Makes Three - John Gottman (protecting your relationship)
2. Cribsheet - Emily Oster (data-driven newborn decisions)
3. The Happiest Baby on the Block - Harvey Karp (calming techniques / 5 S's)
4. The Whole-Brain Child - Daniel Siegel (neuroscience-based parenting)`
  },
  {
    topic: 'How to meal prep and batch cook before baby arrives',
    type: 'guidance',
    generatedAt: now,
    report: `Start in April (2 months out). Target 40-60 portions. Focus on: soups, casseroles, breakfast burritos, pasta bakes, chili. Use gallon freezer bags laid flat for space efficiency. Label everything with date and reheating instructions. Stock up on easy one-hand snacks (granola bars, trail mix, cheese sticks).`
  },
  {
    topic: 'How to create a birth plan',
    type: 'guidance',
    generatedAt: now,
    report: `Discuss with partner: pain management preferences, delivery preferences, C-section contingency, who cuts the cord, skin-to-skin immediately after birth, delayed cord clamping, feeding preferences. Print 3 copies. Review with OB at 36-week appointment. Pre-register at hospital online through patient portal.`
  },
];

goal.updatedAt = now;
fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
console.log('Done: ' + goal.research_questions.length + ' questions, ' + goal.guidance_needed.length + ' guidance, ' + goal.topicReports.length + ' reports saved');
