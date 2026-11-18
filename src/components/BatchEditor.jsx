import { useLanguage } from "../lib/i18n";
import { friendlyMessage, logDiagnostic } from '../lib/notifications';
import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatBatchName, batchUpdatePayload } from '../lib/domain';
export default function BatchEditor({
  batch,
  onSaved,
  onBack
}) {
  const {
    t
  } = useLanguage();
  const [name, setName] = useState(batch.name),
    [order, setOrder] = useState(batch.display_order || 0),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const canonical = formatBatchName(name);
      if (!canonical) throw Error('Please enter a batch name.');
      if (canonical !== formatBatchName(batch.name)) {
        const {
          data: linked,
          error: checkError
        } = await supabase.rpc('smsa_batch_has_content', {
          batch_id: String(batch.id)
        });
        if (checkError) throw checkError;
        if (linked) throw Error('This batch has linked content. Keep its name and update only its display order.');
      }
      const {
        error
      } = await supabase.from('batches').update(batchUpdatePayload(batch, name, order)).eq('id', batch.id).select('id').single();
      if (error) throw error;
      await onSaved();
      setMessage('Your changes have been saved.');
    } catch (e) {
      logDiagnostic(e), setMessage(friendlyMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return <div className="content-card"><button className="btn-outline" onClick={onBack}>{t("Back to batches")}</button><h3>{formatBatchName(batch.name)}</h3><form onSubmit={save}><label>{t("Batch name")}<input required value={name} onChange={e => setName(e.target.value)} /></label><label>{t("Display Order")}<input type="number" value={order} onChange={e => setOrder(e.target.value)} /></label><button className="btn-primary" disabled={busy}>{t("Save Changes")}</button></form><p role="status">{t(message)}</p><p>{t("Deactivate the batch before deletion. Batches with linked members, images or content cannot be deleted.")}</p><button className="reject-btn" disabled={busy || batch.is_active} onClick={async () => {
      if (!window.confirm(t('Delete this empty batch?'))) return;
      setBusy(true);
      const {
        error
      } = await supabase.rpc('smsa_delete_empty_batch', {
        batch_id: String(batch.id)
      });
      if (error) logDiagnostic(error), setMessage(friendlyMessage(error));else {
        await onSaved();
        onBack();
      }
      setBusy(false);
    }}>{t("Delete Batch")}</button></div>;
}
