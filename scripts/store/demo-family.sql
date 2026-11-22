-- Made-up demo family for store screenshots. LOCAL DATABASE ONLY, never production.
-- First sign in on the web build with the test number 5000 0001 and create a family,
-- then: psql "$DB_URL" -f scripts/store/demo-family.sql
-- For the English screenshots, the names were then switched to Sara / Yousef / English titles.
do $$
declare f uuid := (select id from families limit 1); sara uuid; yousef uuid;
begin
delete from children where family_id=f;
insert into children(family_id,first_name,birth_date,gender,nationality_group,color) values (f,'سارة','2026-05-25','girl','kuwaiti','#FF7A59') returning id into sara;
insert into children(family_id,first_name,birth_date,gender,nationality_group,color) values (f,'يوسف','2022-06-02','boy','kuwaiti','#2563EB') returning id into yousef;
update child_vaccinations set status='done', done_on=due_date, clinic='مركز صحي الروضة' where child_id in (sara,yousef) and due_date < date '2026-11-22';
delete from events where family_id=f;
insert into events(family_id,child_id,kind,title,starts_at,ends_at,location,repeat,remind_minutes_before) values
 (f,yousef,'training','تمرين سباحة','2026-11-22 16:30+03','2026-11-22 17:30+03','نادي القادسية','weekly',60),
 (f,sara,'appointment','موعد طبيب الأسنان','2026-11-23 10:00+03','2026-11-23 10:30+03','عيادة السالمية','none',60),
 (f,yousef,'class','درس الإنجليزي','2026-11-24 17:00+03','2026-11-24 18:00+03','أونلاين','weekly',30),
 (f,null,'activity','زيارة الجدة','2026-11-27 18:00+03','2026-11-27 21:00+03','الجابرية','none',120),
 (f,yousef,'activity','حفلة عيد ميلاد صديقه','2026-11-26 16:00+03','2026-11-26 18:00+03','مشرف','none',60);
delete from supply_items where family_id=f;
insert into supply_items(family_id,child_id,category,name,brand,size,quantity,unit,low_threshold) values
 (f,sara,'diapering','حفاضات','بامبرز','مقاس 4',1,'packs',2),
 (f,sara,'diapering','مناديل مبللة','وتر وايبس',null,3,'packs',1),
 (f,sara,'feeding','حليب','أبتاميل','3',1,'tins',1),
 (f,sara,'health','كريم الحفاض',null,null,2,'pcs',1),
 (f,yousef,'health','معجون أسنان للأطفال',null,null,1,'pcs',0),
 (f,yousef,'feeding','عصير بدون سكر',null,null,8,'bottles',3);
end $$;
