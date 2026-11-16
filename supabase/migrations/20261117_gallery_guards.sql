-- Run only after reviewing existing gallery policies and storage paths.
begin;
create function public.smsa_gallery_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare approved_count integer;
begin
 -- Lock the parent row to serialize approval counts per batch.
 perform 1 from public.batches where id=new.batch_id for update;
 if not public.smsa_content_admin() then
   if TG_OP='UPDATE' then raise exception 'Only administrators can moderate gallery records'; end if;
   if new.status <> 'pending' or new.uploader_id <> auth.uid() then raise exception 'Invalid gallery submission'; end if;
   if not exists(select 1 from public.profiles p join public.batches b on regexp_replace(lower(b.name),'^(batch|dakhil)[- ]*','')=regexp_replace(lower(p.batch),'^(batch|dakhil)[- ]*','') where p.id=auth.uid() and b.id=new.batch_id and b.is_active) then raise exception 'Own active batch required'; end if;
   if split_part(new.storage_path,'/',1)<>new.batch_id::text or split_part(new.storage_path,'/',2)<>auth.uid()::text then raise exception 'Invalid storage path'; end if;
 end if;
 if new.status='approved' then
   select count(*) into approved_count from public.gallery_photos where batch_id=new.batch_id and status='approved' and id is distinct from new.id;
   if approved_count>=100 then raise exception 'Maximum 100 approved photos per batch'; end if;
 end if;
 return new;
end $$;
create trigger smsa_gallery_guard before insert or update on public.gallery_photos for each row execute function public.smsa_gallery_guard();
alter table public.gallery_photos enable row level security;
create policy smsa_gallery_visibility on public.gallery_photos as restrictive for select using(status='approved' or uploader_id=auth.uid() or public.smsa_content_admin());
create policy smsa_gallery_delete on public.gallery_photos as restrictive for delete using(public.smsa_content_admin());
-- These guards intersect existing Storage policies; existing permissive policies must also allow intended access.
create policy smsa_gallery_object_visibility on storage.objects as restrictive for select using (
 bucket_id<>'batch-gallery' or public.smsa_content_admin() or exists(select 1 from public.gallery_photos g where g.storage_path=name and (g.status='approved' or g.uploader_id=auth.uid()))
);
create policy smsa_gallery_object_upload on storage.objects as restrictive for insert with check (
 bucket_id<>'batch-gallery' or (auth.uid() is not null and (storage.foldername(name))[2]=auth.uid()::text and exists(select 1 from public.profiles p join public.batches b on lower(b.name)=lower(p.batch) where p.id=auth.uid() and b.id::text=(storage.foldername(name))[1] and b.is_active))
);
create policy smsa_gallery_object_delete on storage.objects as restrictive for delete using (
 bucket_id<>'batch-gallery' or public.smsa_content_admin() or ((storage.foldername(name))[2]=auth.uid()::text and not exists(select 1 from public.gallery_photos g where g.storage_path=name))
);
-- A public bucket bypasses signed URL visibility; require a private existing gallery bucket.
do $$ begin if exists(select 1 from storage.buckets where id='batch-gallery' and public) then raise exception 'batch-gallery must be private. Review bucket configuration before proceeding.'; end if; end $$;
commit;
