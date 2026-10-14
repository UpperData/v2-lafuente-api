const defaultCalendarSession = [
  { day: 0, name: 'Domingo', calendar: { startTime: '00:00', endTime: '00:00' },isActived:false },
  { day: 1, name: 'Lunes', calendar: { startTime: '08:00', endTime: '18:00' },isActived:true },
  { day: 2, name: 'Martes', calendar: { startTime: '08:00', endTime: '18:00' },isActived:true },
  { day: 3, name: 'Miércoles', calendar: { startTime: '08:00', endTime: '18:00' },isActived:true },
  { day: 4, name: 'Jueves', calendar: { startTime: '08:00', endTime: '18:00' },isActived:true},
  { day: 5, name: 'Viernes', calendar: { startTime: '08:00', endTime: '18:00' },isActived:true },
  { day: 6, name: 'Sábado', calendar: { startTime: '08:00', endTime: '18:00' },isActived:true }
];

export function createDefaultCalendarSession() {
  return defaultCalendarSession.map((session) => ({
    ...session,
    calendar: { ...session.calendar },
  }));
}