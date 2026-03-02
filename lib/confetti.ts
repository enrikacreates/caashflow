// Client-side only — call from client components after async actions resolve

export async function bigConfetti() {
  const confetti = (await import('canvas-confetti')).default
  const colors = ['#2563eb', '#22c55e', '#f97316', '#a855f7', '#ec4899']
  const end = Date.now() + 3500

  ;(function frame() {
    confetti({ particleCount: 8, angle: 60, spread: 55, origin: { x: 0 }, colors })
    confetti({ particleCount: 8, angle: 120, spread: 55, origin: { x: 1 }, colors })
    if (Date.now() < end) requestAnimationFrame(frame)
  })()
}

export async function smallConfetti() {
  const confetti = (await import('canvas-confetti')).default
  confetti({
    particleCount: 45,
    spread: 70,
    origin: { y: 0.75 },
    colors: ['#2563eb', '#22c55e', '#f97316'],
    scalar: 0.85,
  })
}
