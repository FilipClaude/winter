import { useState } from 'react';
import { updateDay } from '../../db/repo';
import type { Day } from '../../db/schemas';
import { TextArea } from '../../ui/controls';
import { useOverlay } from '../../ui/overlay-context';
import { Button } from '../../ui/primitives';

export function JournalSheet({ day, close }: { day: Day; close: () => void }) {
  const { toast } = useOverlay();
  const [note, setNote] = useState(day.note);
  const [good, setGood] = useState(day.good);
  const [better, setBetter] = useState(day.better);
  const [tomorrow, setTomorrow] = useState(day.tomorrow);

  async function save() {
    await updateDay(day.date, { note, good, better, tomorrow });
    toast('Notiz gespeichert');
    close();
  }

  return (
    <div className="form">
      <TextArea label="Tagesnotiz" value={note} onValue={setNote} rows={4} maxLength={10_000} placeholder="Wie war der Tag?" />
      <TextArea label="Gut lief" value={good} onValue={setGood} rows={2} maxLength={2000} />
      <TextArea label="Besser machen" value={better} onValue={setBetter} rows={2} maxLength={2000} />
      <TextArea label="Morgen wichtig" value={tomorrow} onValue={setTomorrow} rows={2} maxLength={2000} />
      <Button variant="primary" block onClick={() => void save()}>
        Speichern
      </Button>
    </div>
  );
}
