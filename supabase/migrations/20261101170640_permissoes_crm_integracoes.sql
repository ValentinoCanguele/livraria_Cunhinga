-- Fecha leituras sensíveis e aplica permissões ao CRM e à geografia.

-- Integrações: guardam tokens (WhatsApp, Google Drive). Só o separador "Integrações" as usa,
-- e esse separador é só para administradores. A loja lê o que precisa pela Edge Function.
drop policy if exists "app_integrations: staff lê" on public.app_integrations;
drop policy if exists "app_integrations: configurações cria" on public.app_integrations;
drop policy if exists "app_integrations: configurações edita" on public.app_integrations;
drop policy if exists "app_integrations: admin apaga" on public.app_integrations;
create policy "app_integrations: admin lê" on public.app_integrations for select to authenticated
  using ((select private.is_admin()));
create policy "app_integrations: admin cria" on public.app_integrations for insert to authenticated
  with check ((select private.is_admin()));
create policy "app_integrations: admin edita" on public.app_integrations for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));
create policy "app_integrations: admin apaga" on public.app_integrations for delete to authenticated
  using ((select private.is_admin()));

-- Registo de comunicações: tem emails, telefones e mensagens de clientes. Só administradores.
drop policy if exists "notification_logs: staff lê" on public.notification_logs;
drop policy if exists "notification_logs: staff apaga" on public.notification_logs;
create policy "notification_logs: admin lê" on public.notification_logs for select to authenticated
  using ((select private.is_admin()));
create policy "notification_logs: admin apaga" on public.notification_logs for delete to authenticated
  using ((select private.is_admin()));

-- Configurações do site: inclui credenciais de email e chaves de IA. Ler exige "Configurações".
drop policy if exists "site_settings: staff lê" on public.site_settings;
create policy "site_settings: configurações lê" on public.site_settings for select to authenticated
  using ((select private.has_permission('manage_settings')));

-- CRM (contactos, grupos, campanhas, notificações): equipa com "Utilizadores e Clientes"
-- ou "Marketing". Cada pessoa continua a gerir os contactos que são seus (owner).
drop policy if exists "contacts: staff ou dono lê" on public.contacts;
drop policy if exists "contacts: staff ou dono cria" on public.contacts;
drop policy if exists "contacts: staff ou dono edita" on public.contacts;
drop policy if exists "contacts: staff apaga" on public.contacts;
create policy "contacts: crm ou dono lê" on public.contacts for select to authenticated
  using ((select private.has_permission('manage_users')) or (select private.has_permission('manage_marketing')) or owner = (select auth.uid()));
create policy "contacts: crm ou dono cria" on public.contacts for insert to authenticated
  with check ((select private.has_permission('manage_users')) or (select private.has_permission('manage_marketing')) or owner = (select auth.uid()));
create policy "contacts: crm ou dono edita" on public.contacts for update to authenticated
  using ((select private.has_permission('manage_users')) or (select private.has_permission('manage_marketing')) or owner = (select auth.uid()))
  with check ((select private.has_permission('manage_users')) or (select private.has_permission('manage_marketing')) or owner = (select auth.uid()));
create policy "contacts: crm ou dono apaga" on public.contacts for delete to authenticated
  using ((select private.has_permission('manage_users')) or (select private.has_permission('manage_marketing')) or owner = (select auth.uid()));

drop policy if exists "contact_groups: staff ou dono lê" on public.contact_groups;
drop policy if exists "contact_groups: staff ou dono cria" on public.contact_groups;
drop policy if exists "contact_groups: staff ou dono edita" on public.contact_groups;
drop policy if exists "contact_groups: staff apaga" on public.contact_groups;
create policy "contact_groups: crm ou dono lê" on public.contact_groups for select to authenticated
  using ((select private.has_permission('manage_users')) or (select private.has_permission('manage_marketing')) or owner = (select auth.uid()));
create policy "contact_groups: crm ou dono cria" on public.contact_groups for insert to authenticated
  with check ((select private.has_permission('manage_users')) or (select private.has_permission('manage_marketing')) or owner = (select auth.uid()));
create policy "contact_groups: crm ou dono edita" on public.contact_groups for update to authenticated
  using ((select private.has_permission('manage_users')) or (select private.has_permission('manage_marketing')) or owner = (select auth.uid()))
  with check ((select private.has_permission('manage_users')) or (select private.has_permission('manage_marketing')) or owner = (select auth.uid()));
create policy "contact_groups: crm ou dono apaga" on public.contact_groups for delete to authenticated
  using ((select private.has_permission('manage_users')) or (select private.has_permission('manage_marketing')) or owner = (select auth.uid()));

drop policy if exists "contact_campaigns: staff ou dono lê" on public.contact_campaigns;
drop policy if exists "contact_campaigns: staff ou dono cria" on public.contact_campaigns;
drop policy if exists "contact_campaigns: staff ou dono edita" on public.contact_campaigns;
drop policy if exists "contact_campaigns: staff apaga" on public.contact_campaigns;
create policy "contact_campaigns: crm ou dono lê" on public.contact_campaigns for select to authenticated
  using ((select private.has_permission('manage_users')) or (select private.has_permission('manage_marketing')) or owner = (select auth.uid()));
create policy "contact_campaigns: crm ou dono cria" on public.contact_campaigns for insert to authenticated
  with check ((select private.has_permission('manage_users')) or (select private.has_permission('manage_marketing')) or owner = (select auth.uid()));
create policy "contact_campaigns: crm ou dono edita" on public.contact_campaigns for update to authenticated
  using ((select private.has_permission('manage_users')) or (select private.has_permission('manage_marketing')) or owner = (select auth.uid()))
  with check ((select private.has_permission('manage_users')) or (select private.has_permission('manage_marketing')) or owner = (select auth.uid()));
create policy "contact_campaigns: crm ou dono apaga" on public.contact_campaigns for delete to authenticated
  using ((select private.has_permission('manage_users')) or (select private.has_permission('manage_marketing')) or owner = (select auth.uid()));

drop policy if exists "contact_notifications: staff ou dono lê" on public.contact_notifications;
drop policy if exists "contact_notifications: staff ou dono cria" on public.contact_notifications;
drop policy if exists "contact_notifications: staff edita" on public.contact_notifications;
drop policy if exists "contact_notifications: staff apaga" on public.contact_notifications;
create policy "contact_notifications: crm ou dono lê" on public.contact_notifications for select to authenticated
  using ((select private.has_permission('manage_users')) or (select private.has_permission('manage_marketing')) or owner = (select auth.uid()));
create policy "contact_notifications: crm ou dono cria" on public.contact_notifications for insert to authenticated
  with check ((select private.has_permission('manage_users')) or (select private.has_permission('manage_marketing')) or owner = (select auth.uid()));
create policy "contact_notifications: crm edita" on public.contact_notifications for update to authenticated
  using ((select private.has_permission('manage_users')) or (select private.has_permission('manage_marketing')))
  with check ((select private.has_permission('manage_users')) or (select private.has_permission('manage_marketing')));
create policy "contact_notifications: crm apaga" on public.contact_notifications for delete to authenticated
  using ((select private.has_permission('manage_users')) or (select private.has_permission('manage_marketing')));

-- Geografia de Angola (províncias, municípios, localidades): leitura pública; editar exige "Configurações".
drop policy if exists "angola_provinces: staff cria" on public.angola_provinces;
drop policy if exists "angola_provinces: staff edita" on public.angola_provinces;
create policy "angola_provinces: configurações cria" on public.angola_provinces for insert to authenticated
  with check ((select private.has_permission('manage_settings')));
create policy "angola_provinces: configurações edita" on public.angola_provinces for update to authenticated
  using ((select private.has_permission('manage_settings')))
  with check ((select private.has_permission('manage_settings')));

drop policy if exists "angola_municipalities: staff cria" on public.angola_municipalities;
drop policy if exists "angola_municipalities: staff edita" on public.angola_municipalities;
create policy "angola_municipalities: configurações cria" on public.angola_municipalities for insert to authenticated
  with check ((select private.has_permission('manage_settings')));
create policy "angola_municipalities: configurações edita" on public.angola_municipalities for update to authenticated
  using ((select private.has_permission('manage_settings')))
  with check ((select private.has_permission('manage_settings')));

drop policy if exists "angola_localities: staff cria" on public.angola_localities;
drop policy if exists "angola_localities: staff edita" on public.angola_localities;
create policy "angola_localities: configurações cria" on public.angola_localities for insert to authenticated
  with check ((select private.has_permission('manage_settings')));
create policy "angola_localities: configurações edita" on public.angola_localities for update to authenticated
  using ((select private.has_permission('manage_settings')))
  with check ((select private.has_permission('manage_settings')));
