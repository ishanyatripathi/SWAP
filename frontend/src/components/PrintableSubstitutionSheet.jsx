export default function PrintableSubstitutionSheet({ date, absentTeacherNames, entries }) {
  return (
    <section className="print-sheet">
      <header className="print-sheet-header">
        <div>
          <p className="print-sheet-kicker">S.W.A.P</p>
          <h1>Daily Substitution Timetable</h1>
          <p>Date: {date}</p>
          <p>Absent teachers: {absentTeacherNames?.join(', ') || 'None listed'}</p>
        </div>
        <div className="print-sheet-meta">
          <p>Prepared by: ____________________</p>
          <p>School: _________________________</p>
        </div>
      </header>

      <table>
        <thead>
          <tr>
            <th>Period</th>
            <th>Time</th>
            <th>Class</th>
            <th>Subject</th>
            <th>Absent Teacher</th>
            <th>Substitute</th>
            <th>Room</th>
            <th>Teacher Signature</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, index) => (
            <tr key={`${entry.period}-${entry.class_name}-${index}`}>
              <td>P{entry.period}</td>
              <td>{entry.time_slot || ''}</td>
              <td>{entry.class_name}</td>
              <td>{entry.subject || ''}</td>
              <td>{entry.absent_teacher}</td>
              <td>{entry.substitute_teacher || 'Unassigned'}</td>
              <td>{entry.room || ''}</td>
              <td className="signature-cell" />
            </tr>
          ))}
        </tbody>
      </table>

      <footer className="print-sheet-footer">
        <div>Coordinator signature: __________________________</div>
        <div>Principal signature: _____________________________</div>
      </footer>
    </section>
  )
}
