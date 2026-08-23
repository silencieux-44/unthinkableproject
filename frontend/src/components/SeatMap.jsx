// Renders seats grouped by row. `seats` is the live array from the event (kept in sync via
// socket updates by the parent). `selected` is a Set of seat ids the current user has picked
// in this session (client-side only until hold() succeeds).
export default function SeatMap({ seats, selected, onToggle, disabledIds = new Set() }) {
  const rows = {};
  for (const seat of seats) {
    (rows[seat.rowLabel] ||= []).push(seat);
  }
  const rowLabels = Object.keys(rows).sort();

  return (
    <div>
      <div className="seat-map">
        {rowLabels.map((label) => (
          <div className="seat-row" key={label}>
            <span className="row-label">{label}</span>
            {rows[label]
              .sort((a, b) => a.seatNumber - b.seatNumber)
              .map((seat) => {
                const isSelected = selected.has(seat.id);
                const cls = isSelected ? 'SELECTED' : seat.status;
                const disabled = seat.status !== 'AVAILABLE' && !isSelected || disabledIds.has(seat.id);
                return (
                  <button
                    key={seat.id}
                    className={`seat ${cls}`}
                    disabled={disabled}
                    title={`${seat.rowLabel}${seat.seatNumber} — ${seat.category}`}
                    onClick={() => onToggle(seat)}
                  >
                    {seat.seatNumber}
                  </button>
                );
              })}
          </div>
        ))}
      </div>
      <div className="legend">
        <span><span className="dot" style={{ background: 'var(--seat-available)' }} />Available</span>
        <span><span className="dot" style={{ background: 'var(--seat-selected)' }} />Selected</span>
        <span><span className="dot" style={{ background: 'var(--seat-held)' }} />Held</span>
        <span><span className="dot" style={{ background: 'var(--seat-booked)' }} />Booked</span>
      </div>
    </div>
  );
}
