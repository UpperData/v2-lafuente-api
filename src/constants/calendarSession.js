const defaultCalendarSession = [
  { day: 0, name: 'Domingo', calendar: { startTime: '00:00', endTime: '23:59' } },
  { day: 1, name: 'Lunes', calendar: { startTime: '08:00', endTime: '18:00' } },
  { day: 2, name: 'Martes', calendar: { startTime: '08:00', endTime: '18:00' } },
  { day: 3, name: 'Miércoles', calendar: { startTime: '08:00', endTime: '18:00' } },
  { day: 4, name: 'Jueves', calendar: { startTime: '08:00', endTime: '18:00' } },
  { day: 5, name: 'Viernes', calendar: { startTime: '08:00', endTime: '18:00' } },
  { day: 6, name: 'Sábado', calendar: { startTime: '08:00', endTime: '18:00' } }
];

export function createDefaultCalendarSession() {
  return defaultCalendarSession.map((session) => ({
    ...session,
    calendar: { ...session.calendar },
  }));
}