-- Insertion des données d'exemple - Un enregistrement par table
-- Exécuter dans l'ordre pour respecter les contraintes de clés étrangères

-- 1. Insertion d'un utilisateur admin (doit être créé en premier car d'autres tables y font référence)
-- Note: Les utilisateurs authentifiés sont créés via auth.users, mais nous insérons dans users_profile
-- Pour un vrai test, vous devez d'abord créer un utilisateur via l'authentification Supabase

-- 2. Insertion d'un utilisateur Tracking (page)
INSERT INTO public.users_profile (
    id, 
    role, 
    full_name, 
    phone, 
    is_approved, 
    is_blocked, 
    is_deleted,
    created_at,
    updated_at
) VALUES (
    gen_random_uuid(), -- ID unique
    'Tracking',
    'صفحة تجارية الأولى',
    '21612345678',
    true,
    false,
    false,
    NOW(),
    NOW()
);

-- 3. Insertion des mots-clés
INSERT INTO public.keywords (keyword, is_active, created_at)
VALUES 
    ('مشكلة', true, NOW()),
    ('تأخير', true, NOW()),
    ('رفض', true, NOW'),
    ('عاجل', true, NOW'),
    ('لا يرد', true, NOW')
ON CONFLICT (keyword) DO NOTHING;

-- 4. Insertion d'une commande
INSERT INTO public.orders (
    customer_name,
    customer_phone,
    agent_name,
    agent_phone,
    page_name,
    page_number,
    page_phone,
    page_whatsapp,
    page_id,
    status,
    awaiting_page_reply,
    price,
    price_changed,
    rejected_on_arrival,
    has_issue,
    created_at,
    updated_at
) VALUES (
    'أحمد محمد',
    '21698765432',
    'علي特工',
    '21655555555',
    'صفحة تجارية الأولى',
    '21612345678',
    '21612345678',
    '21612345678',
    (SELECT id FROM public.users_profile WHERE role = 'Tracking' AND full_name = 'صفحة تجارية الأولى' LIMIT 1),
    'معلق',
    true,
    150.00,
    false,
    false,
    false,
    NOW(),
    NOW()
);

-- 5. Insertion d''un message pour cette commande
INSERT INTO public.messages (
    order_id,
    type,
    from_role,
    text,
    media_url,
    audio_duration_sec,
    created_at
) VALUES (
    (SELECT id FROM public.orders WHERE customer_name = 'أحمد محمد' LIMIT 1),
    'text',
    'customer',
    'مرحبا، أريد الاستفسار عن المنتج',
    NULL,
    NULL,
    NOW()
);

-- 6. Insertion de l'historique du statut de la commande
INSERT INTO public.order_status_history (
    order_id,
    status,
    note,
    created_at
) VALUES (
    (SELECT id FROM public.orders WHERE customer_name = 'أحمد محمد' LIMIT 1),
    'معلق',
    'تم إنشاء الطلب',
    NOW()
);

-- 7. Insertion d''un log d'audit (optionnel, sera créé automatiquement par les triggers)
INSERT INTO public.audit_logs (
    actor_id,
    action,
    table_name,
    record_pk,
    old_data,
    new_data,
    meta,
    created_at
) VALUES (
    (SELECT id FROM public.users_profile WHERE role = 'Admin' LIMIT 1),
    'INSERT',
    'orders',
    (SELECT id::text FROM public.orders WHERE customer_name = 'أحمد محمد' LIMIT 1),
    NULL,
    jsonb_build_object('customer_name', 'أحمد محمد', 'status', 'معلق'),
    NULL,
    NOW()
);

-- Vérification des données insérées
SELECT 'Users Profile:' as table_name, COUNT(*) as record_count FROM public.users_profile
UNION ALL
SELECT 'Keywords:', COUNT(*) FROM public.keywords
UNION ALL
SELECT 'Orders:', COUNT(*) FROM public.orders
UNION ALL
SELECT 'Messages:', COUNT(*) FROM public.messages
UNION ALL
SELECT 'Order Status History:', COUNT(*) FROM public.order_status_history
UNION ALL
SELECT 'Audit Logs:', COUNT(*) FROM public.audit_logs;
