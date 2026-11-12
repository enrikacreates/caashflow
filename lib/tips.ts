export type TipTopic = 'Earning' | 'Cash flow' | 'Saving' | 'Budgeting'

const TIPS: Record<TipTopic, string[]> = {
  Earning: [
    'Services are the fastest way to earn. What can you do for someone today?',
    'Message three past clients today. The easiest yes comes from people who already said yes once.',
    'Turn one thing you do for free into a small paid offer with a clear price.',
    'Ask what a client is struggling with right now. The next project is usually in the answer.',
    'Raise your price on your next new client, not your current ones. See what happens.',
    'Sell what you already own. One closet or garage sweep can cover a bill this week.',
    'Offer a paid one-hour session. People will pay for an hour of what you know.',
    'Tell five people exactly what you are looking for. Referrals need specifics.',
    'Package a repeat task into a monthly retainer. Steady beats big.',
    'Weekend gigs count. Pick one that uses a skill you already have.',
    'Follow up on that quote you sent. Most yeses come after the second nudge.',
    'Look at your last 3 paying clients. Who else is just like them?',
  ],
  'Cash flow': [
    'Send the invoice today. Work you have not billed is money you are lending for free.',
    'Ask for a deposit up front. It pays for the start and confirms the client is serious.',
    'Put your payment terms on every invoice, and make the due date a real date.',
    'Follow up on late invoices the day they are due, not the week after.',
    'Line up big bills with the days money usually lands.',
    'Check what is still projected this month. Is any of it waiting on you?',
    'Bill in stages on long projects so one late payment can\'t stall your month.',
    'Make paying you easy: one link, one click, no account needed.',
    'Keep a small buffer in checking so one late payment doesn\'t become a crisis.',
    'Look at your slowest month last year and plan for it now.',
    'A steady retainer smooths out a lumpy year more than one big project.',
    'Before you take on a new expense, ask which income is going to pay for it.',
  ],
  Saving: [
    'Set aside a little from every deposit, before you budget the rest.',
    'Cancel one subscription you forgot you had. Check your last statement.',
    'Rename your savings for what it is for. "Trip to Ghana" is harder to raid than "savings".',
    'Save for taxes as money comes in, not when they come due.',
    'Wait 24 hours on any purchase you did not plan to make today.',
    'When a bill gets paid off, keep moving that amount into savings.',
    'Small wins count. Moving $5 today still builds the habit.',
    'Call one provider and ask for a better rate. Five minutes can pay all year.',
    'Split an annual bill across the months before it is due, so it never surprises you.',
    'Keep your emergency money somewhere a little inconvenient to reach.',
    'Check what you spent eating out last month. Pick a number you would be happy with.',
    'Found money goes further when half gets saved before the fun starts.',
  ],
  Budgeting: [
    'Give every dollar a job before the month gives it one for you.',
    'Budget when money lands, not just at the start of the month.',
    'Pay your must-haves first, then let the rest flow down your priorities.',
    'Ten minutes with your budget this week beats an hour next month.',
    'A budget you adjust is working. Change it without guilt.',
    'Compare what you planned to what happened. No judgment, just notice.',
    'Give yourself some fun money. A budget with no joy doesn\'t last.',
    'Look at what\'s due in the next 7 days, and decide what this check covers.',
    'Budget together. Ten minutes on the same page saves a lot of surprises.',
    'Round your estimates up. A little extra room is better than coming up short.',
    'Archive what you no longer pay, so your list tells the truth.',
    'Count the months you tracked, not the months you got perfect.',
  ],
}

const TOPICS: TipTopic[] = ['Earning', 'Cash flow', 'Saving', 'Budgeting']

/**
 * One tip per calendar day: topics take turns, and each topic works through its own list.
 * `skip` moves forward from today's tip in that same order, so cycling reaches all of them.
 */
export function tipForDate(isoDate: string, skip = 0): { topic: TipTopic; text: string } {
  const [y, m, d] = isoDate.split('-').map(Number)
  const day = Math.floor(Date.UTC(y, m - 1, d) / 86_400_000) + skip
  const topic = TOPICS[day % TOPICS.length]
  const list = TIPS[topic]
  return { topic, text: list[Math.floor(day / TOPICS.length) % list.length] }
}
