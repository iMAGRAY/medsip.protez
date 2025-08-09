--
-- PostgreSQL database dump
--

-- Dumped from database version 17.4 (Ubuntu 17.4-1.pgdg24.04+2)
-- Dumped by pg_dump version 17.5 (Ubuntu 17.5-0ubuntu0.25.04.1)

-- Started on 2025-07-25 10:46:01 UTC

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 355 (class 1255 OID 19838)
-- Name: calculate_configured_price(numeric, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calculate_configured_price(base_price numeric, configuration jsonb) RETURNS numeric
    LANGUAGE plpgsql
    AS $$
      DECLARE
        total_price DECIMAL(10,2) := base_price;
        config_key TEXT;
        config_value JSONB;
        modifier DECIMAL(10,2);
        modifier_type TEXT;
      BEGIN
        -- Если конфигурация пустая, возвращаем базовую цену
        IF configuration IS NULL OR configuration = '{}'::JSONB THEN
          RETURN base_price;
        END IF;

        -- Проходим по всем параметрам конфигурации
        FOR config_key, config_value IN SELECT * FROM jsonb_each(configuration) LOOP
          modifier := (config_value->>'price_modifier')::DECIMAL(10,2);
          modifier_type := config_value->>'price_modifier_type';
          
          IF modifier IS NOT NULL AND modifier != 0 THEN
            IF modifier_type = 'percentage' THEN
              total_price := total_price + (base_price * modifier / 100);
            ELSE
              total_price := total_price + modifier;
            END IF;
          END IF;
        END LOOP;

        RETURN GREATEST(total_price, 0);
      END;
      $$;


--
-- TOC entry 356 (class 1255 OID 18270)
-- Name: cleanup_expired_sessions(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_expired_sessions() RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM user_sessions 
    WHERE expires_at < CURRENT_TIMESTAMP 
       OR last_activity < CURRENT_TIMESTAMP - INTERVAL '30 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;


--
-- TOC entry 348 (class 1255 OID 17745)
-- Name: cleanup_unused_media_files(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_unused_media_files() RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Удаляем медиафайлы, которые не связаны ни с одним товаром
    -- и не использовались более 30 дней
    DELETE FROM media_files 
    WHERE id NOT IN (
        SELECT DISTINCT media_file_id 
        FROM product_media_links
    )
    AND last_accessed_at < CURRENT_TIMESTAMP - INTERVAL '30 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;


--
-- TOC entry 4403 (class 0 OID 0)
-- Dependencies: 348
-- Name: FUNCTION cleanup_unused_media_files(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.cleanup_unused_media_files() IS 'Очистка неиспользуемых медиафайлов старше 30 дней';


--
-- TOC entry 349 (class 1255 OID 17746)
-- Name: find_duplicate_by_hash(character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.find_duplicate_by_hash(input_hash character varying) RETURNS TABLE(id integer, s3_url character varying, original_name character varying, file_size bigint, upload_count integer, first_uploaded_at timestamp without time zone)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        mf.id,
        mf.s3_url,
        mf.original_name,
        mf.file_size,
        mf.upload_count,
        mf.first_uploaded_at
    FROM media_files mf
    WHERE mf.file_hash = input_hash;
END;
$$;


--
-- TOC entry 353 (class 1255 OID 19591)
-- Name: generate_variant_slug(text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_variant_slug(variant_name text, variant_id integer DEFAULT NULL::integer) RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
    base_slug TEXT;
    final_slug TEXT;
    counter INTEGER := 0;
BEGIN
    -- Создаем базовый slug
    base_slug := lower(regexp_replace(variant_name, '[^a-zA-Z0-9а-яА-Я]+', '-', 'g'));
    base_slug := trim(both '-' from base_slug);
    
    final_slug := base_slug;
    
    -- Проверяем уникальность
    WHILE EXISTS (
        SELECT 1 FROM product_variants 
        WHERE slug = final_slug 
        AND (variant_id IS NULL OR id != variant_id)
    ) LOOP
        counter := counter + 1;
        final_slug := base_slug || '-' || counter;
    END LOOP;
    
    RETURN final_slug;
END;
$$;


--
-- TOC entry 351 (class 1255 OID 18926)
-- Name: get_all_available_characteristics(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_all_available_characteristics(p_product_id integer DEFAULT NULL::integer) RETURNS TABLE(group_id integer, group_name character varying, group_description text, group_sort_order integer, show_in_main_params boolean, main_params_priority integer, is_section boolean, characteristic_values json)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cgs.id as group_id,
        cgs.name as group_name,
        cgs.description as group_description,
        cgs.sort_order as group_sort_order,
        cgs.show_in_main_params,
        cgs.main_params_priority,
        cgs.is_section,
        COALESCE(
            JSON_AGG(
                JSON_BUILD_OBJECT(
                    'id', cvs.id,
                    'value', cvs.value,
                    'description', cvs.description,
                    'color_hex', cvs.color_hex,
                    'sort_order', cvs.sort_order,
                    'is_selected', CASE 
                        WHEN p_product_id IS NOT NULL AND pcs.id IS NOT NULL THEN true 
                        ELSE false 
                    END
                ) ORDER BY cvs.sort_order, cvs.value
            ) FILTER (WHERE cvs.id IS NOT NULL), '[]'::json
        ) as values
    FROM characteristics_groups_simple cgs
    LEFT JOIN characteristics_values_simple cvs ON cgs.id = cvs.group_id AND cvs.is_active = true
    LEFT JOIN product_characteristics_simple pcs ON cvs.id = pcs.value_id AND pcs.product_id = p_product_id
    WHERE cgs.is_active = true
    GROUP BY cgs.id, cgs.name, cgs.description, cgs.sort_order, cgs.show_in_main_params, cgs.main_params_priority, cgs.is_section
    ORDER BY cgs.sort_order, cgs.name;
END;
$$;


--
-- TOC entry 359 (class 1255 OID 18924)
-- Name: get_product_characteristics(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_product_characteristics(p_product_id integer) RETURNS TABLE(group_id integer, group_name character varying, group_description text, group_sort_order integer, show_in_main_params boolean, main_params_priority integer, is_section boolean, characteristics json)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cgs.id as group_id,
        cgs.name as group_name,
        cgs.description as group_description,
        cgs.sort_order as group_sort_order,
        cgs.show_in_main_params,
        cgs.main_params_priority,
        cgs.is_section,
        COALESCE(
            JSON_AGG(
                JSON_BUILD_OBJECT(
                    'id', pcs.id,
                    'value_id', cvs.id,
                    'value_name', cvs.value,
                    'value_description', cvs.description,
                    'color_hex', cvs.color_hex,
                    'additional_value', pcs.additional_value,
                    'numeric_value', pcs.numeric_value,
                    'is_primary', pcs.is_primary,
                    'display_order', pcs.display_order,
                    'created_at', pcs.created_at,
                    'updated_at', pcs.updated_at
                ) ORDER BY pcs.display_order, cvs.sort_order, cvs.value
            ) FILTER (WHERE pcs.id IS NOT NULL), '[]'::json
        ) as characteristics
    FROM characteristics_groups_simple cgs
    LEFT JOIN characteristics_values_simple cvs ON cgs.id = cvs.group_id AND cvs.is_active = true
    LEFT JOIN product_characteristics_simple pcs ON cvs.id = pcs.value_id AND pcs.product_id = p_product_id
    WHERE cgs.is_active = true
    GROUP BY cgs.id, cgs.name, cgs.description, cgs.sort_order, cgs.show_in_main_params, cgs.main_params_priority, cgs.is_section
    ORDER BY cgs.sort_order, cgs.name;
END;
$$;


--
-- TOC entry 354 (class 1255 OID 19835)
-- Name: get_variant_attributes(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_variant_attributes(variant_id_param integer) RETURNS json
    LANGUAGE plpgsql
    AS $$
        BEGIN
          RETURN (
            SELECT json_object_agg(vat.code, vav.display_value)
            FROM variant_attributes_new van
            JOIN variant_attribute_types vat ON van.attribute_type_id = vat.id
            JOIN variant_attribute_values vav ON van.attribute_value_id = vav.id
            WHERE van.variant_id = variant_id_param
            AND vat.is_active = true
          );
        END;
        $$;


--
-- TOC entry 352 (class 1255 OID 18919)
-- Name: migrate_eav_to_simple(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.migrate_eav_to_simple() RETURNS TABLE(migrated_groups integer, migrated_values integer, migrated_characteristics integer, skipped_duplicates integer)
    LANGUAGE plpgsql
    AS $$
DECLARE
    group_count INTEGER := 0;
    value_count INTEGER := 0;
    char_count INTEGER := 0;
    skip_count INTEGER := 0;
BEGIN
    -- Миграция групп (только если их нет в simple)
    INSERT INTO characteristics_groups_simple (name, description, sort_order, is_active, show_in_main_params, main_params_priority, is_section)
    SELECT 
        cg.name,
        cg.description,
        cg.ordering,
        cg.is_active,
        cg.show_in_main_params,
        cg.main_params_priority,
        cg.is_section
    FROM characteristic_groups cg
    WHERE cg.is_active = true 
        AND (cg.is_deleted = false OR cg.is_deleted IS NULL)
        AND NOT EXISTS (
            SELECT 1 FROM characteristics_groups_simple cgs 
            WHERE cgs.name = cg.name
        );
    
    GET DIAGNOSTICS group_count = ROW_COUNT;
    
    -- Миграция значений (только если их нет в simple)
    INSERT INTO characteristics_values_simple (group_id, value, color_hex, sort_order, description, is_active)
    SELECT 
        cgs.id,
        COALESCE(cv.display_name, cv.value),
        cv.color_hex,
        COALESCE(cv.sort_order, cv.ordering),
        cv.display_name,
        cv.is_active
    FROM characteristic_values cv
    JOIN characteristic_groups cg ON cv.group_id = cg.id
    JOIN characteristics_groups_simple cgs ON cgs.name = cg.name
    WHERE cv.is_active = true
        AND cg.is_active = true
        AND (cg.is_deleted = false OR cg.is_deleted IS NULL)
        AND NOT EXISTS (
            SELECT 1 FROM characteristics_values_simple cvs 
            WHERE cvs.group_id = cgs.id AND cvs.value = COALESCE(cv.display_name, cv.value)
        );
    
    GET DIAGNOSTICS value_count = ROW_COUNT;
    
    -- Миграция характеристик продуктов (только если их нет в simple)
    INSERT INTO product_characteristics_simple (product_id, value_id, additional_value, numeric_value, is_primary, display_order)
    SELECT DISTINCT
        p.id,
        cvs.id,
        pcn.raw_value,
        pcn.numeric_value,
        false,
        0
    FROM product_characteristics_new pcn
    JOIN product_variants pv ON pcn.variant_id = pv.id
    JOIN products p ON pv.master_id = p.id
    JOIN characteristic_templates ct ON pcn.template_id = ct.id
    JOIN characteristic_groups cg ON ct.group_id = cg.id
    JOIN characteristics_groups_simple cgs ON cgs.name = cg.name
    LEFT JOIN characteristic_values cv ON pcn.enum_value_id = cv.id
    JOIN characteristics_values_simple cvs ON (
        cvs.group_id = cgs.id AND 
        cvs.value = COALESCE(cv.display_name, cv.value, pcn.raw_value)
    )
    WHERE p.in_stock = true
        AND cg.is_active = true
        AND (cg.is_deleted = false OR cg.is_deleted IS NULL)
        AND (pv.is_deleted = false OR pv.is_deleted IS NULL)
        AND NOT EXISTS (
            SELECT 1 FROM product_characteristics_simple pcs 
            WHERE pcs.product_id = p.id AND pcs.value_id = cvs.id
        );
    
    GET DIAGNOSTICS char_count = ROW_COUNT;
    
    -- Подсчет дубликатов (для статистики)
    SELECT COUNT(*) INTO skip_count
    FROM product_characteristics_new pcn
    JOIN product_variants pv ON pcn.variant_id = pv.id
    JOIN products p ON pv.master_id = p.id
    JOIN characteristic_templates ct ON pcn.template_id = ct.id
    JOIN characteristic_groups cg ON ct.group_id = cg.id
    JOIN characteristics_groups_simple cgs ON cgs.name = cg.name
    LEFT JOIN characteristic_values cv ON pcn.enum_value_id = cv.id
    JOIN characteristics_values_simple cvs ON (
        cvs.group_id = cgs.id AND 
        cvs.value = COALESCE(cv.display_name, cv.value, pcn.raw_value)
    )
    WHERE p.in_stock = true
        AND cg.is_active = true
        AND (cg.is_deleted = false OR cg.is_deleted IS NULL)
        AND (pv.is_deleted = false OR pv.is_deleted IS NULL)
        AND EXISTS (
            SELECT 1 FROM product_characteristics_simple pcs 
            WHERE pcs.product_id = p.id AND pcs.value_id = cvs.id
        );
    
    RETURN QUERY SELECT group_count, value_count, char_count, skip_count;
END;
$$;


--
-- TOC entry 358 (class 1255 OID 17924)
-- Name: optimize_database(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.optimize_database() RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
    table_name text;
    result_text text := '';
BEGIN
    -- Очистка мертвых строк и обновление статистики для всех таблиц
    FOR table_name IN 
        SELECT relname FROM pg_stat_user_tables 
        WHERE n_dead_tup > 0 OR last_analyze IS NULL
    LOOP
        EXECUTE 'VACUUM ANALYZE ' || table_name;
        result_text := result_text || 'Оптимизирована таблица: ' || table_name || E'\n';
    END LOOP;
    
    -- Обновление материализованных представлений
    PERFORM refresh_materialized_views();
    result_text := result_text || 'Обновлены материализованные представления' || E'\n';
    
    -- Переиндексация критических таблиц
    REINDEX TABLE products;
    REINDEX TABLE categories;
    REINDEX TABLE product_characteristics;
    result_text := result_text || 'Переиндексированы критические таблицы' || E'\n';
    
    result_text := result_text || 'Оптимизация базы данных завершена успешно!';
    RETURN result_text;
END;
$$;


--
-- TOC entry 347 (class 1255 OID 17923)
-- Name: refresh_materialized_views(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.refresh_materialized_views() RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Обновляем материализованные представления
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_products_fast;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_catalog_menu_with_details;
    
    -- Обновляем статистику
    ANALYZE mv_products_fast;
    ANALYZE mv_catalog_menu_with_details;
    
    RAISE NOTICE 'Материализованные представления обновлены успешно';
END;
$$;


--
-- TOC entry 333 (class 1255 OID 17530)
-- Name: update_catalog_menu_settings_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_catalog_menu_settings_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


--
-- TOC entry 345 (class 1255 OID 17743)
-- Name: update_media_files_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_media_files_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


--
-- TOC entry 346 (class 1255 OID 17696)
-- Name: update_product_characteristics_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_product_characteristics_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


--
-- TOC entry 332 (class 1255 OID 16694)
-- Name: update_product_specifications_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_product_specifications_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


--
-- TOC entry 331 (class 1255 OID 16539)
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


--
-- TOC entry 357 (class 1255 OID 19132)
-- Name: update_variant_characteristics_simple_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_variant_characteristics_simple_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;


--
-- TOC entry 350 (class 1255 OID 18269)
-- Name: user_has_permission(integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.user_has_permission(user_id_param integer, permission_param text) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
DECLARE
    user_permissions TEXT[];
BEGIN
    SELECT r.permissions INTO user_permissions
    FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE u.id = user_id_param AND u.status = 'active' AND r.is_active = true;
    
    IF user_permissions IS NULL THEN
        RETURN false;
    END IF;
    
    -- Проверка на супер-админа (*)
    IF '*' = ANY(user_permissions) THEN
        RETURN true;
    END IF;
    
    -- Проверка точного совпадения
    IF permission_param = ANY(user_permissions) THEN
        RETURN true;
    END IF;
    
    -- Проверка wildcard разрешений (например, products.* для products.read)
    FOR i IN 1..array_length(user_permissions, 1) LOOP
        IF user_permissions[i] LIKE '%.%*' THEN
            IF permission_param LIKE REPLACE(user_permissions[i], '*', '%') THEN
                RETURN true;
            END IF;
        END IF;
    END LOOP;
    
    RETURN false;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 309 (class 1259 OID 19028)
-- Name: catalog_files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.catalog_files (
    id integer NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    file_url character varying(500) NOT NULL,
    file_name character varying(255) NOT NULL,
    file_size bigint,
    file_type character varying(100),
    year integer DEFAULT EXTRACT(year FROM CURRENT_DATE),
    is_active boolean DEFAULT true,
    download_count integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by integer
);


--
-- TOC entry 4404 (class 0 OID 0)
-- Dependencies: 309
-- Name: TABLE catalog_files; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.catalog_files IS 'Таблица для хранения файлов каталогов';


--
-- TOC entry 4405 (class 0 OID 0)
-- Dependencies: 309
-- Name: COLUMN catalog_files.title; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.catalog_files.title IS 'Название каталога';


--
-- TOC entry 4406 (class 0 OID 0)
-- Dependencies: 309
-- Name: COLUMN catalog_files.download_count; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.catalog_files.download_count IS 'Количество скачиваний';


--
-- TOC entry 308 (class 1259 OID 19027)
-- Name: catalog_files_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.catalog_files_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4407 (class 0 OID 0)
-- Dependencies: 308
-- Name: catalog_files_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.catalog_files_id_seq OWNED BY public.catalog_files.id;


--
-- TOC entry 244 (class 1259 OID 17560)
-- Name: catalog_menu_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.catalog_menu_settings (
    id integer NOT NULL,
    entity_type character varying(50) NOT NULL,
    entity_id text NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    sort_order integer DEFAULT 0,
    is_visible boolean DEFAULT true,
    is_expanded boolean DEFAULT false,
    show_in_main_menu boolean DEFAULT true,
    parent_id integer,
    icon character varying(100),
    css_class character varying(100),
    custom_url character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT catalog_menu_settings_entity_type_check CHECK (((entity_type)::text = ANY ((ARRAY['spec_group'::character varying, 'category'::character varying, 'manufacturer'::character varying, 'model_line'::character varying, 'manufacturers_category'::character varying])::text[])))
);


--
-- TOC entry 4408 (class 0 OID 0)
-- Dependencies: 244
-- Name: TABLE catalog_menu_settings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.catalog_menu_settings IS 'Универсальные настройки отображения меню каталога для всех типов сущностей';


--
-- TOC entry 4409 (class 0 OID 0)
-- Dependencies: 244
-- Name: COLUMN catalog_menu_settings.entity_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.catalog_menu_settings.entity_type IS 'Тип сущности: spec_group, category, manufacturer, model_line';


--
-- TOC entry 4410 (class 0 OID 0)
-- Dependencies: 244
-- Name: COLUMN catalog_menu_settings.entity_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.catalog_menu_settings.entity_id IS 'ID сущности в соответствующей таблице';


--
-- TOC entry 4411 (class 0 OID 0)
-- Dependencies: 244
-- Name: COLUMN catalog_menu_settings.name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.catalog_menu_settings.name IS 'Отображаемое имя в меню (может отличаться от оригинального)';


--
-- TOC entry 4412 (class 0 OID 0)
-- Dependencies: 244
-- Name: COLUMN catalog_menu_settings.sort_order; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.catalog_menu_settings.sort_order IS 'Порядок сортировки в меню';


--
-- TOC entry 4413 (class 0 OID 0)
-- Dependencies: 244
-- Name: COLUMN catalog_menu_settings.is_visible; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.catalog_menu_settings.is_visible IS 'Видимость в публичном меню';


--
-- TOC entry 4414 (class 0 OID 0)
-- Dependencies: 244
-- Name: COLUMN catalog_menu_settings.is_expanded; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.catalog_menu_settings.is_expanded IS 'Развернуто ли по умолчанию';


--
-- TOC entry 4415 (class 0 OID 0)
-- Dependencies: 244
-- Name: COLUMN catalog_menu_settings.show_in_main_menu; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.catalog_menu_settings.show_in_main_menu IS 'Показывать в главном меню';


--
-- TOC entry 4416 (class 0 OID 0)
-- Dependencies: 244
-- Name: COLUMN catalog_menu_settings.parent_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.catalog_menu_settings.parent_id IS 'Родительский элемент в иерархии меню (независимо от исходной иерархии)';


--
-- TOC entry 4417 (class 0 OID 0)
-- Dependencies: 244
-- Name: COLUMN catalog_menu_settings.icon; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.catalog_menu_settings.icon IS 'CSS класс иконки';


--
-- TOC entry 4418 (class 0 OID 0)
-- Dependencies: 244
-- Name: COLUMN catalog_menu_settings.custom_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.catalog_menu_settings.custom_url IS 'Пользовательский URL для элемента меню';


--
-- TOC entry 243 (class 1259 OID 17559)
-- Name: catalog_menu_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.catalog_menu_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4419 (class 0 OID 0)
-- Dependencies: 243
-- Name: catalog_menu_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.catalog_menu_settings_id_seq OWNED BY public.catalog_menu_settings.id;


--
-- TOC entry 242 (class 1259 OID 17537)
-- Name: product_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_categories (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    parent_id integer,
    type character varying(50) DEFAULT 'product'::character varying,
    image_url text,
    is_active boolean DEFAULT true,
    sort_order integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    is_deleted boolean DEFAULT false
);


--
-- TOC entry 241 (class 1259 OID 17536)
-- Name: categories_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4420 (class 0 OID 0)
-- Dependencies: 241
-- Name: categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.categories_id_seq OWNED BY public.product_categories.id;


--
-- TOC entry 327 (class 1259 OID 19711)
-- Name: category_attribute_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.category_attribute_types (
    id integer NOT NULL,
    category_id integer NOT NULL,
    attribute_type_id integer NOT NULL,
    is_required boolean DEFAULT false,
    sort_order integer DEFAULT 0
);


--
-- TOC entry 326 (class 1259 OID 19710)
-- Name: category_attribute_types_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.category_attribute_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4421 (class 0 OID 0)
-- Dependencies: 326
-- Name: category_attribute_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.category_attribute_types_id_seq OWNED BY public.category_attribute_types.id;


--
-- TOC entry 298 (class 1259 OID 18763)
-- Name: characteristics_groups_simple; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.characteristics_groups_simple (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    sort_order integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    description text,
    is_active boolean DEFAULT true,
    show_in_main_params boolean DEFAULT false,
    main_params_priority integer DEFAULT 999,
    is_section boolean DEFAULT false,
    category_id integer,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    parent_id integer
);


--
-- TOC entry 304 (class 1259 OID 18969)
-- Name: characteristic_groups; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.characteristic_groups AS
 SELECT id,
    name,
    description,
    sort_order AS ordering,
    is_active,
    show_in_main_params,
    main_params_priority,
    is_section,
    parent_id,
    category_id,
    created_at,
    updated_at
   FROM public.characteristics_groups_simple;


--
-- TOC entry 236 (class 1259 OID 16697)
-- Name: characteristic_groups_legacy; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.characteristic_groups_legacy (
    id integer NOT NULL,
    name text NOT NULL,
    description text,
    default_unit_id integer,
    default_type text,
    group_type character varying(20) DEFAULT 'mixed'::character varying,
    allowed_unit_ids integer[],
    group_settings jsonb DEFAULT '{}'::jsonb,
    ordering integer DEFAULT 0,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    parent_id integer,
    source_type character varying(20) DEFAULT 'catalog'::character varying,
    show_in_main_params boolean DEFAULT false,
    main_params_priority integer,
    main_params_label_override character varying(100) DEFAULT NULL::character varying,
    sort_order integer DEFAULT 0,
    is_deleted boolean DEFAULT false,
    is_section boolean DEFAULT false,
    CONSTRAINT check_group_type CHECK (((group_type)::text = ANY ((ARRAY['numeric'::character varying, 'text'::character varying, 'mixed'::character varying, 'feature'::character varying, 'size'::character varying])::text[]))),
    CONSTRAINT spec_groups_default_type_check CHECK ((default_type = ANY (ARRAY['numeric'::text, 'text'::text, 'enum'::text, 'feature'::text, 'size'::text])))
);


--
-- TOC entry 4422 (class 0 OID 0)
-- Dependencies: 236
-- Name: TABLE characteristic_groups_legacy; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.characteristic_groups_legacy IS 'Группы характеристик продуктов (например: Материал, Вес, Размер)';


--
-- TOC entry 4423 (class 0 OID 0)
-- Dependencies: 236
-- Name: COLUMN characteristic_groups_legacy.is_section; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.characteristic_groups_legacy.is_section IS 'Является ли группа разделом (true) или обычной группой характеристик (false)';


--
-- TOC entry 235 (class 1259 OID 16696)
-- Name: characteristic_groups_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.characteristic_groups_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4424 (class 0 OID 0)
-- Dependencies: 235
-- Name: characteristic_groups_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.characteristic_groups_id_seq OWNED BY public.characteristic_groups_legacy.id;


--
-- TOC entry 283 (class 1259 OID 18371)
-- Name: characteristic_preset_values; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.characteristic_preset_values (
    id integer NOT NULL,
    template_id integer NOT NULL,
    value text NOT NULL,
    display_text text,
    sort_order integer DEFAULT 0,
    is_default boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- TOC entry 282 (class 1259 OID 18370)
-- Name: characteristic_preset_values_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.characteristic_preset_values_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4425 (class 0 OID 0)
-- Dependencies: 282
-- Name: characteristic_preset_values_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.characteristic_preset_values_id_seq OWNED BY public.characteristic_preset_values.id;


--
-- TOC entry 307 (class 1259 OID 18994)
-- Name: characteristic_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.characteristic_templates (
    id integer NOT NULL,
    group_id integer,
    name character varying(255) NOT NULL,
    key character varying(255),
    input_type character varying(50) DEFAULT 'text'::character varying,
    is_required boolean DEFAULT false,
    validation_rules text,
    default_value text,
    placeholder_text text,
    sort_order integer DEFAULT 0,
    is_template boolean DEFAULT true,
    is_deleted boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- TOC entry 306 (class 1259 OID 18993)
-- Name: characteristic_templates_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.characteristic_templates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4426 (class 0 OID 0)
-- Dependencies: 306
-- Name: characteristic_templates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.characteristic_templates_id_seq OWNED BY public.characteristic_templates.id;


--
-- TOC entry 300 (class 1259 OID 18772)
-- Name: characteristics_values_simple; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.characteristics_values_simple (
    id integer NOT NULL,
    group_id integer NOT NULL,
    value character varying(255) NOT NULL,
    color_hex character varying(7),
    sort_order integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    description text,
    is_active boolean DEFAULT true,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- TOC entry 305 (class 1259 OID 18973)
-- Name: characteristic_values; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.characteristic_values AS
 SELECT id,
    group_id,
    value,
    color_hex,
    sort_order,
    created_at,
    description,
    is_active,
    updated_at
   FROM public.characteristics_values_simple;


--
-- TOC entry 238 (class 1259 OID 16719)
-- Name: characteristic_values_legacy; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.characteristic_values_legacy (
    id integer NOT NULL,
    group_id integer,
    value text NOT NULL,
    ordering integer DEFAULT 0,
    parent_id integer,
    color_value character varying(200),
    is_active boolean DEFAULT true NOT NULL,
    display_name text,
    color_hex text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    template_id integer,
    sort_order integer DEFAULT 0
);


--
-- TOC entry 4427 (class 0 OID 0)
-- Dependencies: 238
-- Name: TABLE characteristic_values_legacy; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.characteristic_values_legacy IS 'Возможные значения для характеристик (например: для группы "Материал": титан, алюминий, углепластик)';


--
-- TOC entry 237 (class 1259 OID 16718)
-- Name: characteristic_values_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.characteristic_values_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4428 (class 0 OID 0)
-- Dependencies: 237
-- Name: characteristic_values_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.characteristic_values_id_seq OWNED BY public.characteristic_values_legacy.id;


--
-- TOC entry 293 (class 1259 OID 18628)
-- Name: characteristics_consolidated_backup; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.characteristics_consolidated_backup (
    source_table text,
    entity_id text,
    group_id integer,
    characteristic_type character varying,
    value_text text,
    value_numeric numeric,
    label text,
    created_at timestamp without time zone,
    is_active boolean
);


--
-- TOC entry 297 (class 1259 OID 18762)
-- Name: characteristics_groups_simple_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.characteristics_groups_simple_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4429 (class 0 OID 0)
-- Dependencies: 297
-- Name: characteristics_groups_simple_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.characteristics_groups_simple_id_seq OWNED BY public.characteristics_groups_simple.id;


--
-- TOC entry 299 (class 1259 OID 18771)
-- Name: characteristics_values_simple_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.characteristics_values_simple_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4430 (class 0 OID 0)
-- Dependencies: 299
-- Name: characteristics_values_simple_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.characteristics_values_simple_id_seq OWNED BY public.characteristics_values_simple.id;


--
-- TOC entry 303 (class 1259 OID 18927)
-- Name: eav_backup_before_cleanup; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.eav_backup_before_cleanup (
    variant_id integer,
    template_id integer,
    enum_value_id integer,
    raw_value text,
    numeric_value numeric(15,4),
    bool_value boolean,
    date_value date,
    file_url character varying(500),
    created_at timestamp without time zone,
    updated_at timestamp without time zone,
    id integer
);


--
-- TOC entry 252 (class 1259 OID 17857)
-- Name: form_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.form_templates (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    characteristics jsonb DEFAULT '[]'::jsonb NOT NULL,
    is_favorite boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- TOC entry 251 (class 1259 OID 17856)
-- Name: form_templates_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.form_templates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4431 (class 0 OID 0)
-- Dependencies: 251
-- Name: form_templates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.form_templates_id_seq OWNED BY public.form_templates.id;


--
-- TOC entry 228 (class 1259 OID 16580)
-- Name: manufacturers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.manufacturers (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    logo_url text,
    website_url text,
    country character varying(100),
    founded_year integer,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by integer,
    updated_by integer,
    is_deleted boolean DEFAULT false,
    CONSTRAINT check_website_url_format CHECK (((website_url IS NULL) OR (website_url ~ '^https?://'::text)))
);


--
-- TOC entry 227 (class 1259 OID 16579)
-- Name: manufacturers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.manufacturers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4432 (class 0 OID 0)
-- Dependencies: 227
-- Name: manufacturers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.manufacturers_id_seq OWNED BY public.manufacturers.id;


--
-- TOC entry 248 (class 1259 OID 17699)
-- Name: media_files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.media_files (
    id integer NOT NULL,
    file_hash character varying(64) NOT NULL,
    original_name character varying(255) NOT NULL,
    file_extension character varying(10) NOT NULL,
    file_size bigint NOT NULL,
    mime_type character varying(100) NOT NULL,
    s3_key character varying(500) NOT NULL,
    s3_url character varying(500) NOT NULL,
    width integer,
    height integer,
    upload_count integer DEFAULT 1,
    first_uploaded_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    last_accessed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    metadata jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- TOC entry 4433 (class 0 OID 0)
-- Dependencies: 248
-- Name: TABLE media_files; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.media_files IS 'Таблица для дедупликации медиафайлов по хешу';


--
-- TOC entry 4434 (class 0 OID 0)
-- Dependencies: 248
-- Name: COLUMN media_files.file_hash; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.media_files.file_hash IS 'SHA-256 хеш для идентификации дубликатов';


--
-- TOC entry 4435 (class 0 OID 0)
-- Dependencies: 248
-- Name: COLUMN media_files.upload_count; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.media_files.upload_count IS 'Счетчик попыток загрузки одинаковых файлов';


--
-- TOC entry 247 (class 1259 OID 17698)
-- Name: media_files_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.media_files_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4436 (class 0 OID 0)
-- Dependencies: 247
-- Name: media_files_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.media_files_id_seq OWNED BY public.media_files.id;


--
-- TOC entry 226 (class 1259 OID 16551)
-- Name: model_series; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.model_series (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    category_id integer,
    image_url text,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    manufacturer_id integer,
    code character varying(100),
    is_deleted boolean DEFAULT false
);


--
-- TOC entry 4437 (class 0 OID 0)
-- Dependencies: 226
-- Name: TABLE model_series; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.model_series IS 'Модельные ряды продуктов (например: МедСИП Pro, МедСИП Flex)';


--
-- TOC entry 4438 (class 0 OID 0)
-- Dependencies: 226
-- Name: COLUMN model_series.name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.model_series.name IS 'Название модельного ряда';


--
-- TOC entry 4439 (class 0 OID 0)
-- Dependencies: 226
-- Name: COLUMN model_series.description; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.model_series.description IS 'Описание модельного ряда';


--
-- TOC entry 4440 (class 0 OID 0)
-- Dependencies: 226
-- Name: COLUMN model_series.category_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.model_series.category_id IS 'Категория к которой относится модельный ряд';


--
-- TOC entry 4441 (class 0 OID 0)
-- Dependencies: 226
-- Name: COLUMN model_series.sort_order; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.model_series.sort_order IS 'Порядок сортировки для отображения';


--
-- TOC entry 225 (class 1259 OID 16550)
-- Name: model_lines_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.model_lines_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4442 (class 0 OID 0)
-- Dependencies: 225
-- Name: model_lines_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.model_lines_id_seq OWNED BY public.model_series.id;


--
-- TOC entry 281 (class 1259 OID 18302)
-- Name: order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_items (
    id integer NOT NULL,
    order_id integer NOT NULL,
    product_id character varying(255) NOT NULL,
    product_name character varying(255) NOT NULL,
    product_price numeric(10,2) NOT NULL,
    product_image_url text,
    quantity integer DEFAULT 1 NOT NULL,
    total_price numeric(10,2) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    sku character varying(100),
    article_number character varying(100),
    is_on_request boolean DEFAULT false,
    custom_price numeric(10,2),
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    status character varying(50),
    notes text,
    variant_id integer,
    configuration jsonb
);


--
-- TOC entry 4443 (class 0 OID 0)
-- Dependencies: 281
-- Name: COLUMN order_items.sku; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.order_items.sku IS 'SKU товара';


--
-- TOC entry 4444 (class 0 OID 0)
-- Dependencies: 281
-- Name: COLUMN order_items.article_number; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.order_items.article_number IS 'Артикул товара';


--
-- TOC entry 280 (class 1259 OID 18301)
-- Name: order_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.order_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4445 (class 0 OID 0)
-- Dependencies: 280
-- Name: order_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.order_items_id_seq OWNED BY public.order_items.id;


--
-- TOC entry 279 (class 1259 OID 18290)
-- Name: orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orders (
    id integer NOT NULL,
    customer_phone character varying(20) NOT NULL,
    customer_email character varying(255) NOT NULL,
    total_amount numeric(10,2) NOT NULL,
    status character varying(50) DEFAULT 'pending'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    notes text
);


--
-- TOC entry 278 (class 1259 OID 18289)
-- Name: orders_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4446 (class 0 OID 0)
-- Dependencies: 278
-- Name: orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.orders_id_seq OWNED BY public.orders.id;


--
-- TOC entry 290 (class 1259 OID 18453)
-- Name: price_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.price_logs (
    id integer NOT NULL,
    variant_id integer NOT NULL,
    old_price numeric(12,2),
    new_price numeric(12,2),
    start_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    end_date timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- TOC entry 289 (class 1259 OID 18452)
-- Name: price_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.price_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4447 (class 0 OID 0)
-- Dependencies: 289
-- Name: price_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.price_logs_id_seq OWNED BY public.price_logs.id;


--
-- TOC entry 292 (class 1259 OID 18543)
-- Name: product_certificates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_certificates (
    id integer NOT NULL,
    variant_id integer NOT NULL,
    template_id integer,
    file_url character varying(500) NOT NULL,
    valid_until date,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- TOC entry 291 (class 1259 OID 18542)
-- Name: product_certificates_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.product_certificates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4448 (class 0 OID 0)
-- Dependencies: 291
-- Name: product_certificates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.product_certificates_id_seq OWNED BY public.product_certificates.id;


--
-- TOC entry 296 (class 1259 OID 18756)
-- Name: product_characteristics_new_backup_final; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_characteristics_new_backup_final (
    variant_id integer,
    template_id integer,
    enum_value_id integer,
    raw_value text,
    numeric_value numeric(15,4),
    bool_value boolean,
    date_value date,
    file_url character varying(500),
    created_at timestamp without time zone,
    updated_at timestamp without time zone,
    id integer
);


--
-- TOC entry 302 (class 1259 OID 18786)
-- Name: product_characteristics_simple; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_characteristics_simple (
    id integer NOT NULL,
    product_id integer NOT NULL,
    value_id integer NOT NULL,
    additional_value text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    is_primary boolean DEFAULT false,
    numeric_value numeric(15,4),
    display_order integer DEFAULT 0
);


--
-- TOC entry 301 (class 1259 OID 18785)
-- Name: product_characteristics_simple_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.product_characteristics_simple_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4449 (class 0 OID 0)
-- Dependencies: 301
-- Name: product_characteristics_simple_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.product_characteristics_simple_id_seq OWNED BY public.product_characteristics_simple.id;


--
-- TOC entry 246 (class 1259 OID 17657)
-- Name: product_images; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_images (
    id integer NOT NULL,
    product_id integer NOT NULL,
    image_url text NOT NULL,
    image_order integer DEFAULT 1,
    is_main boolean DEFAULT false,
    alt_text text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    variant_id integer,
    type character varying(50) DEFAULT 'gallery'::character varying,
    sort_order integer DEFAULT 0
);


--
-- TOC entry 245 (class 1259 OID 17656)
-- Name: product_images_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.product_images_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4450 (class 0 OID 0)
-- Dependencies: 245
-- Name: product_images_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.product_images_id_seq OWNED BY public.product_images.id;


--
-- TOC entry 250 (class 1259 OID 17715)
-- Name: product_media_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_media_links (
    id integer NOT NULL,
    product_id integer NOT NULL,
    media_file_id integer NOT NULL,
    is_main boolean DEFAULT false,
    display_order integer DEFAULT 1,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- TOC entry 4451 (class 0 OID 0)
-- Dependencies: 250
-- Name: TABLE product_media_links; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.product_media_links IS 'Связи между товарами и медиафайлами (many-to-many)';


--
-- TOC entry 249 (class 1259 OID 17714)
-- Name: product_media_links_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.product_media_links_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4452 (class 0 OID 0)
-- Dependencies: 249
-- Name: product_media_links_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.product_media_links_id_seq OWNED BY public.product_media_links.id;


--
-- TOC entry 295 (class 1259 OID 18644)
-- Name: product_selection_tables; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_selection_tables (
    id integer NOT NULL,
    product_id integer NOT NULL,
    sku character varying(50),
    table_type character varying(50) NOT NULL,
    title character varying(255) NOT NULL,
    headers jsonb NOT NULL,
    rows jsonb NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- TOC entry 4453 (class 0 OID 0)
-- Dependencies: 295
-- Name: TABLE product_selection_tables; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.product_selection_tables IS 'Stores selection tables data for products (weight/activity, size/stiffness matrices)';


--
-- TOC entry 4454 (class 0 OID 0)
-- Dependencies: 295
-- Name: COLUMN product_selection_tables.table_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.product_selection_tables.table_type IS 'Type of selection table: weightActivityTable, sizeStiffnessTable, technicalTable';


--
-- TOC entry 4455 (class 0 OID 0)
-- Dependencies: 295
-- Name: COLUMN product_selection_tables.headers; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.product_selection_tables.headers IS 'JSON array of table column headers';


--
-- TOC entry 4456 (class 0 OID 0)
-- Dependencies: 295
-- Name: COLUMN product_selection_tables.rows; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.product_selection_tables.rows IS 'JSON array of table row data';


--
-- TOC entry 294 (class 1259 OID 18643)
-- Name: product_selection_tables_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.product_selection_tables_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4457 (class 0 OID 0)
-- Dependencies: 294
-- Name: product_selection_tables_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.product_selection_tables_id_seq OWNED BY public.product_selection_tables.id;


--
-- TOC entry 230 (class 1259 OID 16601)
-- Name: product_sizes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_sizes (
    id integer NOT NULL,
    product_id integer NOT NULL,
    size_name character varying(100) NOT NULL,
    size_value character varying(100),
    sku character varying(150),
    price numeric(12,2),
    stock_quantity integer DEFAULT 0,
    weight numeric(8,3),
    dimensions jsonb,
    specifications jsonb,
    is_available boolean DEFAULT true,
    sort_order integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    discount_price numeric(12,2),
    name character varying(500),
    description text,
    image_url character varying(500),
    images jsonb DEFAULT '[]'::jsonb,
    warranty character varying(255),
    battery_life character varying(255),
    meta_title character varying(255),
    meta_description text,
    meta_keywords text,
    is_featured boolean DEFAULT false,
    is_new boolean DEFAULT false,
    is_bestseller boolean DEFAULT false,
    custom_fields jsonb DEFAULT '{}'::jsonb,
    characteristics jsonb DEFAULT '[]'::jsonb,
    selection_tables jsonb DEFAULT '[]'::jsonb,
    CONSTRAINT positive_price CHECK ((price >= (0)::numeric)),
    CONSTRAINT positive_stock CHECK ((stock_quantity >= 0)),
    CONSTRAINT positive_weight CHECK ((weight >= (0)::numeric))
);


--
-- TOC entry 4458 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN product_sizes.discount_price; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.product_sizes.discount_price IS 'Цена со скидкой для варианта товара';


--
-- TOC entry 4459 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN product_sizes.name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.product_sizes.name IS 'Полное название варианта товара';


--
-- TOC entry 4460 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN product_sizes.description; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.product_sizes.description IS 'Подробное описание варианта';


--
-- TOC entry 4461 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN product_sizes.image_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.product_sizes.image_url IS 'Основное изображение варианта';


--
-- TOC entry 4462 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN product_sizes.images; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.product_sizes.images IS 'Массив дополнительных изображений варианта';


--
-- TOC entry 4463 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN product_sizes.warranty; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.product_sizes.warranty IS 'Гарантийный срок для варианта';


--
-- TOC entry 4464 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN product_sizes.battery_life; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.product_sizes.battery_life IS 'Время работы от батареи для варианта';


--
-- TOC entry 4465 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN product_sizes.meta_title; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.product_sizes.meta_title IS 'SEO заголовок варианта';


--
-- TOC entry 4466 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN product_sizes.meta_description; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.product_sizes.meta_description IS 'SEO описание варианта';


--
-- TOC entry 4467 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN product_sizes.meta_keywords; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.product_sizes.meta_keywords IS 'SEO ключевые слова варианта';


--
-- TOC entry 4468 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN product_sizes.is_featured; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.product_sizes.is_featured IS 'Рекомендуемый вариант';


--
-- TOC entry 4469 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN product_sizes.is_new; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.product_sizes.is_new IS 'Новинка';


--
-- TOC entry 4470 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN product_sizes.is_bestseller; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.product_sizes.is_bestseller IS 'Хит продаж';


--
-- TOC entry 4471 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN product_sizes.custom_fields; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.product_sizes.custom_fields IS 'Дополнительные пользовательские поля';


--
-- TOC entry 4472 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN product_sizes.characteristics; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.product_sizes.characteristics IS 'Характеристики варианта';


--
-- TOC entry 4473 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN product_sizes.selection_tables; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.product_sizes.selection_tables IS 'Таблицы подбора для варианта';


--
-- TOC entry 229 (class 1259 OID 16600)
-- Name: product_sizes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.product_sizes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4474 (class 0 OID 0)
-- Dependencies: 229
-- Name: product_sizes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.product_sizes_id_seq OWNED BY public.product_sizes.id;


--
-- TOC entry 288 (class 1259 OID 18436)
-- Name: product_suppliers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_suppliers (
    variant_id integer NOT NULL,
    supplier_id integer NOT NULL,
    supplier_sku character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- TOC entry 285 (class 1259 OID 18406)
-- Name: product_variants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_variants (
    id integer NOT NULL,
    master_id integer NOT NULL,
    sku character varying(255),
    price_override numeric(12,2),
    stock_override integer,
    attributes_json jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    is_deleted boolean DEFAULT false,
    slug character varying(500),
    name character varying(500) NOT NULL,
    description text,
    short_description text,
    cost_price numeric(10,2),
    reserved_quantity integer DEFAULT 0,
    min_stock_level integer DEFAULT 0,
    max_stock_level integer,
    weight numeric(10,3),
    length numeric(10,2),
    width numeric(10,2),
    height numeric(10,2),
    primary_image_url character varying(500),
    images jsonb DEFAULT '[]'::jsonb,
    videos jsonb DEFAULT '[]'::jsonb,
    documents jsonb DEFAULT '[]'::jsonb,
    attributes jsonb DEFAULT '{}'::jsonb,
    meta_title character varying(255),
    meta_description text,
    meta_keywords text,
    is_featured boolean DEFAULT false,
    is_new boolean DEFAULT false,
    is_bestseller boolean DEFAULT false,
    is_recommended boolean DEFAULT false,
    warranty_months integer,
    battery_life_hours integer,
    custom_fields jsonb DEFAULT '{}'::jsonb,
    is_active boolean DEFAULT true,
    price numeric(10,2),
    discount_price numeric(10,2),
    stock_quantity integer DEFAULT 0,
    sort_order integer DEFAULT 0,
    category_id integer,
    stock_status character varying(50) DEFAULT 'in_stock'::character varying,
    show_price boolean DEFAULT true,
    short_name character varying(255)
);


--
-- TOC entry 4475 (class 0 OID 0)
-- Dependencies: 285
-- Name: TABLE product_variants; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.product_variants IS 'Основная таблица вариантов товаров с полной информацией';


--
-- TOC entry 4476 (class 0 OID 0)
-- Dependencies: 285
-- Name: COLUMN product_variants.master_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.product_variants.master_id IS 'ID товара';


--
-- TOC entry 4477 (class 0 OID 0)
-- Dependencies: 285
-- Name: COLUMN product_variants.reserved_quantity; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.product_variants.reserved_quantity IS 'Зарезервированное количество';


--
-- TOC entry 4478 (class 0 OID 0)
-- Dependencies: 285
-- Name: COLUMN product_variants.attributes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.product_variants.attributes IS 'JSON с атрибутами варианта (размер, цвет и т.д.)';


--
-- TOC entry 4479 (class 0 OID 0)
-- Dependencies: 285
-- Name: COLUMN product_variants.custom_fields; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.product_variants.custom_fields IS 'Дополнительные пользовательские поля в формате JSON';


--
-- TOC entry 4480 (class 0 OID 0)
-- Dependencies: 285
-- Name: COLUMN product_variants.stock_quantity; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.product_variants.stock_quantity IS 'Общее количество на складе';


--
-- TOC entry 4481 (class 0 OID 0)
-- Dependencies: 285
-- Name: COLUMN product_variants.category_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.product_variants.category_id IS 'Категория варианта товара. Если NULL, используется категория товара';


--
-- TOC entry 4482 (class 0 OID 0)
-- Dependencies: 285
-- Name: COLUMN product_variants.stock_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.product_variants.stock_status IS 'Статус наличия: in_stock, out_of_stock, on_order, discontinued';


--
-- TOC entry 4483 (class 0 OID 0)
-- Dependencies: 285
-- Name: COLUMN product_variants.show_price; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.product_variants.show_price IS 'Показывать ли цену товара';


--
-- TOC entry 4484 (class 0 OID 0)
-- Dependencies: 285
-- Name: COLUMN product_variants.short_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.product_variants.short_name IS 'Краткое название для отображения в карточках товаров';


--
-- TOC entry 284 (class 1259 OID 18405)
-- Name: product_variants_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.product_variants_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4485 (class 0 OID 0)
-- Dependencies: 284
-- Name: product_variants_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.product_variants_id_seq OWNED BY public.product_variants.id;


--
-- TOC entry 224 (class 1259 OID 16519)
-- Name: product_view_stats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_view_stats (
    id integer NOT NULL,
    product_id integer,
    views integer DEFAULT 0,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- TOC entry 223 (class 1259 OID 16518)
-- Name: product_view_stats_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.product_view_stats_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4486 (class 0 OID 0)
-- Dependencies: 223
-- Name: product_view_stats_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.product_view_stats_id_seq OWNED BY public.product_view_stats.id;


--
-- TOC entry 222 (class 1259 OID 16447)
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    id integer NOT NULL,
    name character varying(500) NOT NULL,
    category_id integer,
    description text,
    image_url text,
    images jsonb DEFAULT '[]'::jsonb,
    weight character varying(50),
    battery_life character varying(100),
    warranty character varying(100),
    in_stock boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    model_line_id integer,
    stock_quantity integer DEFAULT 0,
    stock_status character varying(20) DEFAULT 'in_stock'::character varying,
    manufacturer_id integer,
    sku character varying(100),
    article_number character varying(100),
    price numeric(10,2),
    discount_price numeric(10,2),
    series_id integer,
    specs_cache jsonb,
    created_by integer,
    updated_by integer,
    is_deleted boolean DEFAULT false,
    show_price boolean DEFAULT true NOT NULL,
    CONSTRAINT check_price_positive CHECK (((price IS NULL) OR (price >= (0)::numeric))),
    CONSTRAINT check_stock_quantity_non_negative CHECK ((stock_quantity >= 0)),
    CONSTRAINT check_stock_status_new CHECK (((stock_status)::text = ANY ((ARRAY['in_stock'::character varying, 'out_of_stock'::character varying, 'on_order'::character varying, 'distant_warehouse'::character varying, 'nearby_warehouse'::character varying])::text[]))),
    CONSTRAINT chk_products_name_not_empty CHECK (((name IS NOT NULL) AND (TRIM(BOTH FROM name) <> ''::text))),
    CONSTRAINT chk_products_price_positive CHECK (((price IS NULL) OR (price > (0)::numeric)))
);


--
-- TOC entry 4487 (class 0 OID 0)
-- Dependencies: 222
-- Name: COLUMN products.model_line_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.products.model_line_id IS 'Связь с модельным рядом';


--
-- TOC entry 4488 (class 0 OID 0)
-- Dependencies: 222
-- Name: COLUMN products.show_price; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.products.show_price IS 'Controls whether price is displayed on frontend for this product';


--
-- TOC entry 221 (class 1259 OID 16446)
-- Name: products_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.products_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4489 (class 0 OID 0)
-- Dependencies: 221
-- Name: products_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.products_id_seq OWNED BY public.products.id;


--
-- TOC entry 270 (class 1259 OID 18181)
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    id integer NOT NULL,
    name character varying(50) NOT NULL,
    display_name character varying(100) NOT NULL,
    description text,
    permissions text[],
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- TOC entry 4490 (class 0 OID 0)
-- Dependencies: 270
-- Name: TABLE roles; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.roles IS 'Роли пользователей с набором разрешений';


--
-- TOC entry 4491 (class 0 OID 0)
-- Dependencies: 270
-- Name: COLUMN roles.permissions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.roles.permissions IS 'Массив строк с правами доступа (например: products.*, users.read)';


--
-- TOC entry 269 (class 1259 OID 18180)
-- Name: roles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.roles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4492 (class 0 OID 0)
-- Dependencies: 269
-- Name: roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.roles_id_seq OWNED BY public.roles.id;


--
-- TOC entry 240 (class 1259 OID 17478)
-- Name: site_menu; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.site_menu (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    url character varying(500),
    spec_group_id integer,
    sort_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    is_external boolean DEFAULT false,
    open_in_new_tab boolean DEFAULT false,
    icon_class character varying(100),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- TOC entry 239 (class 1259 OID 17477)
-- Name: site_menu_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.site_menu_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4493 (class 0 OID 0)
-- Dependencies: 239
-- Name: site_menu_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.site_menu_id_seq OWNED BY public.site_menu.id;


--
-- TOC entry 220 (class 1259 OID 16392)
-- Name: site_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.site_settings (
    id integer NOT NULL,
    site_name character varying(255) DEFAULT 'MedSIP Prosthetics'::character varying NOT NULL,
    site_description text,
    hero_title character varying(500),
    hero_subtitle text,
    contact_email character varying(255),
    contact_phone character varying(50),
    address text,
    social_media jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    additional_contacts jsonb DEFAULT '[]'::jsonb
);


--
-- TOC entry 219 (class 1259 OID 16391)
-- Name: site_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.site_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4494 (class 0 OID 0)
-- Dependencies: 219
-- Name: site_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.site_settings_id_seq OWNED BY public.site_settings.id;


--
-- TOC entry 234 (class 1259 OID 16646)
-- Name: size_chart_values; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.size_chart_values (
    id integer NOT NULL,
    size_chart_id integer NOT NULL,
    size_name character varying(100) NOT NULL,
    size_value character varying(100),
    min_value numeric(8,2),
    max_value numeric(8,2),
    description text,
    sort_order integer DEFAULT 0,
    is_active boolean DEFAULT true
);


--
-- TOC entry 233 (class 1259 OID 16645)
-- Name: size_chart_values_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.size_chart_values_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4495 (class 0 OID 0)
-- Dependencies: 233
-- Name: size_chart_values_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.size_chart_values_id_seq OWNED BY public.size_chart_values.id;


--
-- TOC entry 232 (class 1259 OID 16627)
-- Name: size_charts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.size_charts (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    category_id integer,
    size_type character varying(50) NOT NULL,
    unit character varying(20),
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- TOC entry 231 (class 1259 OID 16626)
-- Name: size_charts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.size_charts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4496 (class 0 OID 0)
-- Dependencies: 231
-- Name: size_charts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.size_charts_id_seq OWNED BY public.size_charts.id;


--
-- TOC entry 313 (class 1259 OID 19146)
-- Name: spec_enums; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.spec_enums AS
 SELECT id,
    group_id,
    value,
    description,
    sort_order,
    is_active,
    color_hex,
    created_at,
    updated_at
   FROM public.characteristics_values_simple;


--
-- TOC entry 312 (class 1259 OID 19142)
-- Name: spec_groups; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.spec_groups AS
 SELECT id,
    name,
    description,
    sort_order AS ordering,
    parent_id,
    is_active,
    created_at,
    updated_at,
    show_in_main_params,
    main_params_priority,
    is_section,
    category_id
   FROM public.characteristics_groups_simple;


--
-- TOC entry 287 (class 1259 OID 18425)
-- Name: suppliers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.suppliers (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    contact_info jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    is_deleted boolean DEFAULT false
);


--
-- TOC entry 286 (class 1259 OID 18424)
-- Name: suppliers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.suppliers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4497 (class 0 OID 0)
-- Dependencies: 286
-- Name: suppliers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.suppliers_id_seq OWNED BY public.suppliers.id;


--
-- TOC entry 275 (class 1259 OID 18241)
-- Name: user_audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_audit_log (
    id integer NOT NULL,
    user_id integer,
    action character varying(100) NOT NULL,
    resource_type character varying(50),
    resource_id integer,
    details jsonb,
    ip_address inet,
    user_agent text,
    session_id character varying(128),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- TOC entry 4498 (class 0 OID 0)
-- Dependencies: 275
-- Name: TABLE user_audit_log; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.user_audit_log IS 'Журнал действий пользователей для аудита безопасности';


--
-- TOC entry 274 (class 1259 OID 18240)
-- Name: user_audit_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_audit_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4499 (class 0 OID 0)
-- Dependencies: 274
-- Name: user_audit_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_audit_log_id_seq OWNED BY public.user_audit_log.id;


--
-- TOC entry 273 (class 1259 OID 18225)
-- Name: user_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_sessions (
    id character varying(128) NOT NULL,
    user_id integer NOT NULL,
    ip_address inet,
    user_agent text,
    csrf_token character varying(64),
    remember_me boolean DEFAULT false,
    expires_at timestamp without time zone NOT NULL,
    last_activity timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- TOC entry 4500 (class 0 OID 0)
-- Dependencies: 273
-- Name: TABLE user_sessions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.user_sessions IS 'Активные сессии пользователей для аутентификации';


--
-- TOC entry 272 (class 1259 OID 18195)
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    username character varying(100) NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    role_id integer,
    first_name character varying(100),
    last_name character varying(100),
    status character varying(20) DEFAULT 'active'::character varying,
    email_verified boolean DEFAULT false,
    last_login timestamp without time zone,
    login_count integer DEFAULT 0,
    failed_login_attempts integer DEFAULT 0,
    locked_until timestamp without time zone,
    password_changed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by integer,
    notes text,
    CONSTRAINT users_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying, 'blocked'::character varying, 'pending'::character varying])::text[])))
);


--
-- TOC entry 4501 (class 0 OID 0)
-- Dependencies: 272
-- Name: TABLE users; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.users IS 'Пользователи системы с аутентификацией и ролями';


--
-- TOC entry 4502 (class 0 OID 0)
-- Dependencies: 272
-- Name: COLUMN users.password_hash; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.password_hash IS 'BCrypt хеш пароля (rounds=12)';


--
-- TOC entry 4503 (class 0 OID 0)
-- Dependencies: 272
-- Name: COLUMN users.failed_login_attempts; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.failed_login_attempts IS 'Счетчик неудачных попыток входа';


--
-- TOC entry 4504 (class 0 OID 0)
-- Dependencies: 272
-- Name: COLUMN users.locked_until; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.locked_until IS 'Время до которого аккаунт заблокирован';


--
-- TOC entry 271 (class 1259 OID 18194)
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4505 (class 0 OID 0)
-- Dependencies: 271
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- TOC entry 314 (class 1259 OID 19155)
-- Name: v_all_product_variants; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_all_product_variants AS
 SELECT pv.id,
    pv.master_id AS product_id,
    pv.name,
    pv.sku,
    pv.price,
    pv.discount_price,
    pv.stock_quantity,
    pv.is_active,
    pv.sort_order,
    pv.created_at,
    pv.updated_at,
    p.name AS product_name,
    p.category_id,
    'product_variants'::text AS source
   FROM (public.product_variants pv
     JOIN public.products p ON ((pv.master_id = p.id)))
  WHERE (((pv.is_deleted = false) OR (pv.is_deleted IS NULL)) AND ((p.is_deleted = false) OR (p.is_deleted IS NULL)));


--
-- TOC entry 325 (class 1259 OID 19586)
-- Name: v_product_variants_full; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_product_variants_full AS
SELECT
    NULL::integer AS id,
    NULL::integer AS master_id,
    NULL::character varying(255) AS sku,
    NULL::numeric(12,2) AS price_override,
    NULL::integer AS stock_override,
    NULL::jsonb AS attributes_json,
    NULL::timestamp without time zone AS created_at,
    NULL::timestamp without time zone AS updated_at,
    NULL::boolean AS is_deleted,
    NULL::character varying(500) AS slug,
    NULL::character varying(500) AS name,
    NULL::text AS description,
    NULL::text AS short_description,
    NULL::numeric(10,2) AS cost_price,
    NULL::integer AS reserved_quantity,
    NULL::integer AS min_stock_level,
    NULL::integer AS max_stock_level,
    NULL::numeric(10,3) AS weight,
    NULL::numeric(10,2) AS length,
    NULL::numeric(10,2) AS width,
    NULL::numeric(10,2) AS height,
    NULL::character varying(500) AS primary_image_url,
    NULL::jsonb AS images,
    NULL::jsonb AS videos,
    NULL::jsonb AS documents,
    NULL::jsonb AS attributes,
    NULL::character varying(255) AS meta_title,
    NULL::text AS meta_description,
    NULL::text AS meta_keywords,
    NULL::boolean AS is_featured,
    NULL::boolean AS is_new,
    NULL::boolean AS is_bestseller,
    NULL::boolean AS is_recommended,
    NULL::integer AS warranty_months,
    NULL::integer AS battery_life_hours,
    NULL::jsonb AS custom_fields,
    NULL::boolean AS is_active,
    NULL::numeric(10,2) AS price,
    NULL::numeric(10,2) AS discount_price,
    NULL::integer AS stock_quantity,
    NULL::integer AS sort_order,
    NULL::integer AS category_id,
    NULL::character varying(50) AS stock_status,
    NULL::boolean AS show_price,
    NULL::character varying(255) AS short_name,
    NULL::character varying(500) AS master_name,
    NULL::integer AS manufacturer_id,
    NULL::integer AS series_id,
    NULL::character varying(255) AS category_name,
    NULL::character varying(255) AS manufacturer_name,
    NULL::character varying(255) AS series_name,
    NULL::integer AS available_stock,
    NULL::boolean AS in_stock,
    NULL::bigint AS image_count,
    NULL::bigint AS characteristic_count;


--
-- TOC entry 316 (class 1259 OID 19485)
-- Name: variant_attribute_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.variant_attribute_types (
    id integer NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(255) NOT NULL,
    display_name character varying(255),
    input_type character varying(50) DEFAULT 'select'::character varying NOT NULL,
    is_required boolean DEFAULT false,
    sort_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    allow_multiple boolean DEFAULT false,
    show_in_filter boolean DEFAULT true,
    icon character varying(50),
    description text,
    validation_rules jsonb DEFAULT '{}'::jsonb
);


--
-- TOC entry 315 (class 1259 OID 19484)
-- Name: variant_attribute_types_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.variant_attribute_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4506 (class 0 OID 0)
-- Dependencies: 315
-- Name: variant_attribute_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.variant_attribute_types_id_seq OWNED BY public.variant_attribute_types.id;


--
-- TOC entry 318 (class 1259 OID 19502)
-- Name: variant_attribute_values; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.variant_attribute_values (
    id integer NOT NULL,
    attribute_type_id integer NOT NULL,
    value character varying(255) NOT NULL,
    display_value character varying(255),
    color_hex character varying(7),
    image_url character varying(500),
    sort_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    additional_info text,
    metadata jsonb DEFAULT '{}'::jsonb,
    price_modifier numeric(10,2) DEFAULT 0,
    price_modifier_type character varying(20) DEFAULT 'fixed'::character varying
);


--
-- TOC entry 317 (class 1259 OID 19501)
-- Name: variant_attribute_values_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.variant_attribute_values_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4507 (class 0 OID 0)
-- Dependencies: 317
-- Name: variant_attribute_values_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.variant_attribute_values_id_seq OWNED BY public.variant_attribute_values.id;


--
-- TOC entry 329 (class 1259 OID 19734)
-- Name: variant_attributes_new; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.variant_attributes_new (
    id integer NOT NULL,
    variant_id integer NOT NULL,
    attribute_type_id integer NOT NULL,
    attribute_value_id integer NOT NULL,
    custom_value text,
    sort_order integer DEFAULT 0
);


--
-- TOC entry 328 (class 1259 OID 19733)
-- Name: variant_attributes_new_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.variant_attributes_new_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4508 (class 0 OID 0)
-- Dependencies: 328
-- Name: variant_attributes_new_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.variant_attributes_new_id_seq OWNED BY public.variant_attributes_new.id;


--
-- TOC entry 330 (class 1259 OID 19763)
-- Name: variant_attributes_view; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.variant_attributes_view AS
 SELECT va.id,
    va.variant_id,
    va.custom_value,
    va.sort_order,
    vat.id AS type_id,
    vat.code AS type_code,
    vat.name AS type_name,
    vat.display_name AS type_display_name,
    vat.input_type,
    vat.icon,
    vav.id AS value_id,
    vav.value,
    vav.display_value,
    vav.additional_info,
    vav.color_hex,
    vav.image_url
   FROM ((public.variant_attributes_new va
     JOIN public.variant_attribute_types vat ON ((va.attribute_type_id = vat.id)))
     JOIN public.variant_attribute_values vav ON ((va.attribute_value_id = vav.id)))
  WHERE ((vat.is_active = true) AND (vav.is_active = true))
  ORDER BY va.sort_order, vat.sort_order;


--
-- TOC entry 320 (class 1259 OID 19521)
-- Name: variant_characteristics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.variant_characteristics (
    id integer NOT NULL,
    variant_id integer NOT NULL,
    template_id integer NOT NULL,
    text_value text,
    numeric_value numeric(20,6),
    boolean_value boolean,
    date_value date,
    "json_value" jsonb,
    is_highlighted boolean DEFAULT false,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- TOC entry 319 (class 1259 OID 19520)
-- Name: variant_characteristics_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.variant_characteristics_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4509 (class 0 OID 0)
-- Dependencies: 319
-- Name: variant_characteristics_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.variant_characteristics_id_seq OWNED BY public.variant_characteristics.id;


--
-- TOC entry 311 (class 1259 OID 19108)
-- Name: variant_characteristics_simple; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.variant_characteristics_simple (
    id integer NOT NULL,
    variant_id integer NOT NULL,
    value_id integer NOT NULL,
    additional_value text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- TOC entry 4510 (class 0 OID 0)
-- Dependencies: 311
-- Name: TABLE variant_characteristics_simple; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.variant_characteristics_simple IS 'Характеристики вариантов товаров в упрощенной системе';


--
-- TOC entry 4511 (class 0 OID 0)
-- Dependencies: 311
-- Name: COLUMN variant_characteristics_simple.variant_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.variant_characteristics_simple.variant_id IS 'ID варианта товара';


--
-- TOC entry 4512 (class 0 OID 0)
-- Dependencies: 311
-- Name: COLUMN variant_characteristics_simple.value_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.variant_characteristics_simple.value_id IS 'ID значения характеристики из characteristics_values_simple';


--
-- TOC entry 4513 (class 0 OID 0)
-- Dependencies: 311
-- Name: COLUMN variant_characteristics_simple.additional_value; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.variant_characteristics_simple.additional_value IS 'Дополнительное значение (например, для уточнения)';


--
-- TOC entry 310 (class 1259 OID 19107)
-- Name: variant_characteristics_simple_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.variant_characteristics_simple_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4514 (class 0 OID 0)
-- Dependencies: 310
-- Name: variant_characteristics_simple_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.variant_characteristics_simple_id_seq OWNED BY public.variant_characteristics_simple.id;


--
-- TOC entry 322 (class 1259 OID 19549)
-- Name: variant_images; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.variant_images (
    id integer NOT NULL,
    variant_id integer NOT NULL,
    url character varying(500) NOT NULL,
    alt_text character varying(255),
    title character varying(255),
    is_primary boolean DEFAULT false,
    image_type character varying(50),
    sort_order integer DEFAULT 0,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- TOC entry 321 (class 1259 OID 19548)
-- Name: variant_images_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.variant_images_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4515 (class 0 OID 0)
-- Dependencies: 321
-- Name: variant_images_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.variant_images_id_seq OWNED BY public.variant_images.id;


--
-- TOC entry 324 (class 1259 OID 19570)
-- Name: variant_price_tiers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.variant_price_tiers (
    id integer NOT NULL,
    variant_id integer NOT NULL,
    user_group character varying(50) NOT NULL,
    price numeric(10,2) NOT NULL,
    min_quantity integer DEFAULT 1,
    max_quantity integer,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- TOC entry 323 (class 1259 OID 19569)
-- Name: variant_price_tiers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.variant_price_tiers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4516 (class 0 OID 0)
-- Dependencies: 323
-- Name: variant_price_tiers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.variant_price_tiers_id_seq OWNED BY public.variant_price_tiers.id;


--
-- TOC entry 268 (class 1259 OID 18121)
-- Name: warehouse_articles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.warehouse_articles (
    id integer NOT NULL,
    article_code character varying(50) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    category character varying(100),
    subcategory character varying(100),
    brand character varying(100),
    model character varying(100),
    unit_of_measure character varying(20) DEFAULT 'шт'::character varying,
    weight_kg numeric(10,3),
    dimensions_cm character varying(50),
    barcode character varying(100),
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- TOC entry 267 (class 1259 OID 18120)
-- Name: warehouse_articles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.warehouse_articles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4517 (class 0 OID 0)
-- Dependencies: 267
-- Name: warehouse_articles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.warehouse_articles_id_seq OWNED BY public.warehouse_articles.id;


--
-- TOC entry 264 (class 1259 OID 18076)
-- Name: warehouse_cities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.warehouse_cities (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    region_id integer,
    code character varying(10) NOT NULL,
    description text,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- TOC entry 263 (class 1259 OID 18075)
-- Name: warehouse_cities_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.warehouse_cities_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4518 (class 0 OID 0)
-- Dependencies: 263
-- Name: warehouse_cities_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.warehouse_cities_id_seq OWNED BY public.warehouse_cities.id;


--
-- TOC entry 258 (class 1259 OID 17997)
-- Name: warehouse_inventory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.warehouse_inventory (
    id integer NOT NULL,
    product_id integer,
    sku character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    section_id integer,
    quantity integer DEFAULT 0 NOT NULL,
    min_stock integer DEFAULT 0 NOT NULL,
    max_stock integer DEFAULT 100 NOT NULL,
    unit_price numeric(10,2),
    total_value numeric(12,2) GENERATED ALWAYS AS (((quantity)::numeric * unit_price)) STORED,
    status character varying(50) DEFAULT 'active'::character varying,
    expiry_date date,
    batch_number character varying(100),
    supplier character varying(255),
    last_counted timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    article_id integer,
    warehouse_id integer
);


--
-- TOC entry 257 (class 1259 OID 17996)
-- Name: warehouse_inventory_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.warehouse_inventory_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4519 (class 0 OID 0)
-- Dependencies: 257
-- Name: warehouse_inventory_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.warehouse_inventory_id_seq OWNED BY public.warehouse_inventory.id;


--
-- TOC entry 260 (class 1259 OID 18025)
-- Name: warehouse_movements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.warehouse_movements (
    id integer NOT NULL,
    inventory_id integer NOT NULL,
    movement_type character varying(50) NOT NULL,
    quantity integer NOT NULL,
    from_section_id integer,
    to_section_id integer,
    reason character varying(255),
    reference_number character varying(100),
    user_name character varying(255),
    notes text,
    movement_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- TOC entry 259 (class 1259 OID 18024)
-- Name: warehouse_movements_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.warehouse_movements_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4520 (class 0 OID 0)
-- Dependencies: 259
-- Name: warehouse_movements_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.warehouse_movements_id_seq OWNED BY public.warehouse_movements.id;


--
-- TOC entry 262 (class 1259 OID 18062)
-- Name: warehouse_regions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.warehouse_regions (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    code character varying(10) NOT NULL,
    description text,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- TOC entry 261 (class 1259 OID 18061)
-- Name: warehouse_regions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.warehouse_regions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4521 (class 0 OID 0)
-- Dependencies: 261
-- Name: warehouse_regions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.warehouse_regions_id_seq OWNED BY public.warehouse_regions.id;


--
-- TOC entry 256 (class 1259 OID 17977)
-- Name: warehouse_sections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.warehouse_sections (
    id integer NOT NULL,
    zone_id integer NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    capacity integer DEFAULT 10 NOT NULL,
    row_number integer,
    shelf_number integer,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- TOC entry 255 (class 1259 OID 17976)
-- Name: warehouse_sections_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.warehouse_sections_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4522 (class 0 OID 0)
-- Dependencies: 255
-- Name: warehouse_sections_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.warehouse_sections_id_seq OWNED BY public.warehouse_sections.id;


--
-- TOC entry 277 (class 1259 OID 18275)
-- Name: warehouse_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.warehouse_settings (
    id integer NOT NULL,
    setting_key character varying(255) NOT NULL,
    setting_value text,
    data_type character varying(50) DEFAULT 'string'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- TOC entry 276 (class 1259 OID 18274)
-- Name: warehouse_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.warehouse_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4523 (class 0 OID 0)
-- Dependencies: 276
-- Name: warehouse_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.warehouse_settings_id_seq OWNED BY public.warehouse_settings.id;


--
-- TOC entry 266 (class 1259 OID 18095)
-- Name: warehouse_warehouses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.warehouse_warehouses (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    city_id integer,
    code character varying(20) NOT NULL,
    address text,
    phone character varying(50),
    email character varying(100),
    manager_name character varying(255),
    total_capacity integer DEFAULT 0,
    warehouse_type character varying(50) DEFAULT 'standard'::character varying,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- TOC entry 265 (class 1259 OID 18094)
-- Name: warehouse_warehouses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.warehouse_warehouses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4524 (class 0 OID 0)
-- Dependencies: 265
-- Name: warehouse_warehouses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.warehouse_warehouses_id_seq OWNED BY public.warehouse_warehouses.id;


--
-- TOC entry 254 (class 1259 OID 17962)
-- Name: warehouse_zones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.warehouse_zones (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    location character varying(255),
    capacity integer DEFAULT 100 NOT NULL,
    temperature_min numeric(4,1),
    temperature_max numeric(4,1),
    humidity_min numeric(4,1),
    humidity_max numeric(4,1),
    is_active boolean DEFAULT true NOT NULL,
    last_inspection timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    warehouse_id integer,
    code character varying(20)
);


--
-- TOC entry 253 (class 1259 OID 17961)
-- Name: warehouse_zones_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.warehouse_zones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4525 (class 0 OID 0)
-- Dependencies: 253
-- Name: warehouse_zones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.warehouse_zones_id_seq OWNED BY public.warehouse_zones.id;


--
-- TOC entry 3815 (class 2604 OID 19031)
-- Name: catalog_files id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalog_files ALTER COLUMN id SET DEFAULT nextval('public.catalog_files_id_seq'::regclass);


--
-- TOC entry 3652 (class 2604 OID 17563)
-- Name: catalog_menu_settings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalog_menu_settings ALTER COLUMN id SET DEFAULT nextval('public.catalog_menu_settings_id_seq'::regclass);


--
-- TOC entry 3855 (class 2604 OID 19714)
-- Name: category_attribute_types id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category_attribute_types ALTER COLUMN id SET DEFAULT nextval('public.category_attribute_types_id_seq'::regclass);


--
-- TOC entry 3619 (class 2604 OID 16700)
-- Name: characteristic_groups_legacy id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.characteristic_groups_legacy ALTER COLUMN id SET DEFAULT nextval('public.characteristic_groups_id_seq'::regclass);


--
-- TOC entry 3751 (class 2604 OID 18374)
-- Name: characteristic_preset_values id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.characteristic_preset_values ALTER COLUMN id SET DEFAULT nextval('public.characteristic_preset_values_id_seq'::regclass);


--
-- TOC entry 3807 (class 2604 OID 18997)
-- Name: characteristic_templates id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.characteristic_templates ALTER COLUMN id SET DEFAULT nextval('public.characteristic_templates_id_seq'::regclass);


--
-- TOC entry 3632 (class 2604 OID 16722)
-- Name: characteristic_values_legacy id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.characteristic_values_legacy ALTER COLUMN id SET DEFAULT nextval('public.characteristic_values_id_seq'::regclass);


--
-- TOC entry 3789 (class 2604 OID 18766)
-- Name: characteristics_groups_simple id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.characteristics_groups_simple ALTER COLUMN id SET DEFAULT nextval('public.characteristics_groups_simple_id_seq'::regclass);


--
-- TOC entry 3797 (class 2604 OID 18775)
-- Name: characteristics_values_simple id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.characteristics_values_simple ALTER COLUMN id SET DEFAULT nextval('public.characteristics_values_simple_id_seq'::regclass);


--
-- TOC entry 3676 (class 2604 OID 17860)
-- Name: form_templates id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_templates ALTER COLUMN id SET DEFAULT nextval('public.form_templates_id_seq'::regclass);


--
-- TOC entry 3593 (class 2604 OID 16583)
-- Name: manufacturers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manufacturers ALTER COLUMN id SET DEFAULT nextval('public.manufacturers_id_seq'::regclass);


--
-- TOC entry 3666 (class 2604 OID 17702)
-- Name: media_files id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_files ALTER COLUMN id SET DEFAULT nextval('public.media_files_id_seq'::regclass);


--
-- TOC entry 3587 (class 2604 OID 16554)
-- Name: model_series id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_series ALTER COLUMN id SET DEFAULT nextval('public.model_lines_id_seq'::regclass);


--
-- TOC entry 3746 (class 2604 OID 18305)
-- Name: order_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items ALTER COLUMN id SET DEFAULT nextval('public.order_items_id_seq'::regclass);


--
-- TOC entry 3742 (class 2604 OID 18293)
-- Name: orders id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders ALTER COLUMN id SET DEFAULT nextval('public.orders_id_seq'::regclass);


--
-- TOC entry 3780 (class 2604 OID 18456)
-- Name: price_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.price_logs ALTER COLUMN id SET DEFAULT nextval('public.price_logs_id_seq'::regclass);


--
-- TOC entry 3645 (class 2604 OID 17540)
-- Name: product_categories id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_categories ALTER COLUMN id SET DEFAULT nextval('public.categories_id_seq'::regclass);


--
-- TOC entry 3783 (class 2604 OID 18546)
-- Name: product_certificates id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_certificates ALTER COLUMN id SET DEFAULT nextval('public.product_certificates_id_seq'::regclass);


--
-- TOC entry 3802 (class 2604 OID 18789)
-- Name: product_characteristics_simple id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_characteristics_simple ALTER COLUMN id SET DEFAULT nextval('public.product_characteristics_simple_id_seq'::regclass);


--
-- TOC entry 3659 (class 2604 OID 17660)
-- Name: product_images id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_images ALTER COLUMN id SET DEFAULT nextval('public.product_images_id_seq'::regclass);


--
-- TOC entry 3672 (class 2604 OID 17718)
-- Name: product_media_links id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_media_links ALTER COLUMN id SET DEFAULT nextval('public.product_media_links_id_seq'::regclass);


--
-- TOC entry 3785 (class 2604 OID 18647)
-- Name: product_selection_tables id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_selection_tables ALTER COLUMN id SET DEFAULT nextval('public.product_selection_tables_id_seq'::regclass);


--
-- TOC entry 3599 (class 2604 OID 16604)
-- Name: product_sizes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_sizes ALTER COLUMN id SET DEFAULT nextval('public.product_sizes_id_seq'::regclass);


--
-- TOC entry 3755 (class 2604 OID 18409)
-- Name: product_variants id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_variants ALTER COLUMN id SET DEFAULT nextval('public.product_variants_id_seq'::regclass);


--
-- TOC entry 3584 (class 2604 OID 16522)
-- Name: product_view_stats id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_view_stats ALTER COLUMN id SET DEFAULT nextval('public.product_view_stats_id_seq'::regclass);


--
-- TOC entry 3575 (class 2604 OID 16450)
-- Name: products id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products ALTER COLUMN id SET DEFAULT nextval('public.products_id_seq'::regclass);


--
-- TOC entry 3721 (class 2604 OID 18184)
-- Name: roles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles ALTER COLUMN id SET DEFAULT nextval('public.roles_id_seq'::regclass);


--
-- TOC entry 3638 (class 2604 OID 17481)
-- Name: site_menu id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_menu ALTER COLUMN id SET DEFAULT nextval('public.site_menu_id_seq'::regclass);


--
-- TOC entry 3569 (class 2604 OID 16395)
-- Name: site_settings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_settings ALTER COLUMN id SET DEFAULT nextval('public.site_settings_id_seq'::regclass);


--
-- TOC entry 3616 (class 2604 OID 16649)
-- Name: size_chart_values id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.size_chart_values ALTER COLUMN id SET DEFAULT nextval('public.size_chart_values_id_seq'::regclass);


--
-- TOC entry 3612 (class 2604 OID 16630)
-- Name: size_charts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.size_charts ALTER COLUMN id SET DEFAULT nextval('public.size_charts_id_seq'::regclass);


--
-- TOC entry 3775 (class 2604 OID 18428)
-- Name: suppliers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppliers ALTER COLUMN id SET DEFAULT nextval('public.suppliers_id_seq'::regclass);


--
-- TOC entry 3736 (class 2604 OID 18244)
-- Name: user_audit_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_audit_log ALTER COLUMN id SET DEFAULT nextval('public.user_audit_log_id_seq'::regclass);


--
-- TOC entry 3725 (class 2604 OID 18198)
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- TOC entry 3824 (class 2604 OID 19488)
-- Name: variant_attribute_types id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.variant_attribute_types ALTER COLUMN id SET DEFAULT nextval('public.variant_attribute_types_id_seq'::regclass);


--
-- TOC entry 3834 (class 2604 OID 19505)
-- Name: variant_attribute_values id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.variant_attribute_values ALTER COLUMN id SET DEFAULT nextval('public.variant_attribute_values_id_seq'::regclass);


--
-- TOC entry 3858 (class 2604 OID 19737)
-- Name: variant_attributes_new id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.variant_attributes_new ALTER COLUMN id SET DEFAULT nextval('public.variant_attributes_new_id_seq'::regclass);


--
-- TOC entry 3841 (class 2604 OID 19524)
-- Name: variant_characteristics id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.variant_characteristics ALTER COLUMN id SET DEFAULT nextval('public.variant_characteristics_id_seq'::regclass);


--
-- TOC entry 3821 (class 2604 OID 19111)
-- Name: variant_characteristics_simple id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.variant_characteristics_simple ALTER COLUMN id SET DEFAULT nextval('public.variant_characteristics_simple_id_seq'::regclass);


--
-- TOC entry 3846 (class 2604 OID 19552)
-- Name: variant_images id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.variant_images ALTER COLUMN id SET DEFAULT nextval('public.variant_images_id_seq'::regclass);


--
-- TOC entry 3851 (class 2604 OID 19573)
-- Name: variant_price_tiers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.variant_price_tiers ALTER COLUMN id SET DEFAULT nextval('public.variant_price_tiers_id_seq'::regclass);


--
-- TOC entry 3716 (class 2604 OID 18124)
-- Name: warehouse_articles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse_articles ALTER COLUMN id SET DEFAULT nextval('public.warehouse_articles_id_seq'::regclass);


--
-- TOC entry 3706 (class 2604 OID 18079)
-- Name: warehouse_cities id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse_cities ALTER COLUMN id SET DEFAULT nextval('public.warehouse_cities_id_seq'::regclass);


--
-- TOC entry 3691 (class 2604 OID 18000)
-- Name: warehouse_inventory id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse_inventory ALTER COLUMN id SET DEFAULT nextval('public.warehouse_inventory_id_seq'::regclass);


--
-- TOC entry 3699 (class 2604 OID 18028)
-- Name: warehouse_movements id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse_movements ALTER COLUMN id SET DEFAULT nextval('public.warehouse_movements_id_seq'::regclass);


--
-- TOC entry 3702 (class 2604 OID 18065)
-- Name: warehouse_regions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse_regions ALTER COLUMN id SET DEFAULT nextval('public.warehouse_regions_id_seq'::regclass);


--
-- TOC entry 3686 (class 2604 OID 17980)
-- Name: warehouse_sections id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse_sections ALTER COLUMN id SET DEFAULT nextval('public.warehouse_sections_id_seq'::regclass);


--
-- TOC entry 3738 (class 2604 OID 18278)
-- Name: warehouse_settings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse_settings ALTER COLUMN id SET DEFAULT nextval('public.warehouse_settings_id_seq'::regclass);


--
-- TOC entry 3710 (class 2604 OID 18098)
-- Name: warehouse_warehouses id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse_warehouses ALTER COLUMN id SET DEFAULT nextval('public.warehouse_warehouses_id_seq'::regclass);


--
-- TOC entry 3681 (class 2604 OID 17965)
-- Name: warehouse_zones id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse_zones ALTER COLUMN id SET DEFAULT nextval('public.warehouse_zones_id_seq'::regclass);


--
-- TOC entry 4122 (class 2606 OID 19040)
-- Name: catalog_files catalog_files_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalog_files
    ADD CONSTRAINT catalog_files_pkey PRIMARY KEY (id);


--
-- TOC entry 3957 (class 2606 OID 17615)
-- Name: catalog_menu_settings catalog_menu_settings_entity_type_entity_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalog_menu_settings
    ADD CONSTRAINT catalog_menu_settings_entity_type_entity_id_key UNIQUE (entity_type, entity_id);


--
-- TOC entry 3959 (class 2606 OID 17574)
-- Name: catalog_menu_settings catalog_menu_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalog_menu_settings
    ADD CONSTRAINT catalog_menu_settings_pkey PRIMARY KEY (id);


--
-- TOC entry 3946 (class 2606 OID 17549)
-- Name: product_categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- TOC entry 4158 (class 2606 OID 19720)
-- Name: category_attribute_types category_attribute_types_category_id_attribute_type_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category_attribute_types
    ADD CONSTRAINT category_attribute_types_category_id_attribute_type_id_key UNIQUE (category_id, attribute_type_id);


--
-- TOC entry 4160 (class 2606 OID 19718)
-- Name: category_attribute_types category_attribute_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category_attribute_types
    ADD CONSTRAINT category_attribute_types_pkey PRIMARY KEY (id);


--
-- TOC entry 4065 (class 2606 OID 18381)
-- Name: characteristic_preset_values characteristic_preset_values_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.characteristic_preset_values
    ADD CONSTRAINT characteristic_preset_values_pkey PRIMARY KEY (id);


--
-- TOC entry 4120 (class 2606 OID 19008)
-- Name: characteristic_templates characteristic_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.characteristic_templates
    ADD CONSTRAINT characteristic_templates_pkey PRIMARY KEY (id);


--
-- TOC entry 4105 (class 2606 OID 18770)
-- Name: characteristics_groups_simple characteristics_groups_simple_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.characteristics_groups_simple
    ADD CONSTRAINT characteristics_groups_simple_pkey PRIMARY KEY (id);


--
-- TOC entry 4109 (class 2606 OID 18779)
-- Name: characteristics_values_simple characteristics_values_simple_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.characteristics_values_simple
    ADD CONSTRAINT characteristics_values_simple_pkey PRIMARY KEY (id);


--
-- TOC entry 3982 (class 2606 OID 17868)
-- Name: form_templates form_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_templates
    ADD CONSTRAINT form_templates_pkey PRIMARY KEY (id);


--
-- TOC entry 3903 (class 2606 OID 16591)
-- Name: manufacturers manufacturers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manufacturers
    ADD CONSTRAINT manufacturers_pkey PRIMARY KEY (id);


--
-- TOC entry 3971 (class 2606 OID 17713)
-- Name: media_files media_files_file_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_files
    ADD CONSTRAINT media_files_file_hash_key UNIQUE (file_hash);


--
-- TOC entry 3973 (class 2606 OID 17711)
-- Name: media_files media_files_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_files
    ADD CONSTRAINT media_files_pkey PRIMARY KEY (id);


--
-- TOC entry 3898 (class 2606 OID 16564)
-- Name: model_series model_lines_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_series
    ADD CONSTRAINT model_lines_name_key UNIQUE (name);


--
-- TOC entry 3900 (class 2606 OID 16562)
-- Name: model_series model_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_series
    ADD CONSTRAINT model_lines_pkey PRIMARY KEY (id);


--
-- TOC entry 4063 (class 2606 OID 18311)
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- TOC entry 4058 (class 2606 OID 18300)
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- TOC entry 4094 (class 2606 OID 18460)
-- Name: price_logs price_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.price_logs
    ADD CONSTRAINT price_logs_pkey PRIMARY KEY (id);


--
-- TOC entry 4096 (class 2606 OID 18551)
-- Name: product_certificates product_certificates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_certificates
    ADD CONSTRAINT product_certificates_pkey PRIMARY KEY (id);


--
-- TOC entry 4116 (class 2606 OID 18795)
-- Name: product_characteristics_simple product_characteristics_simple_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_characteristics_simple
    ADD CONSTRAINT product_characteristics_simple_pkey PRIMARY KEY (id);


--
-- TOC entry 4118 (class 2606 OID 18797)
-- Name: product_characteristics_simple product_characteristics_simple_product_id_value_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_characteristics_simple
    ADD CONSTRAINT product_characteristics_simple_product_id_value_id_key UNIQUE (product_id, value_id);


--
-- TOC entry 3964 (class 2606 OID 17668)
-- Name: product_images product_images_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_images
    ADD CONSTRAINT product_images_pkey PRIMARY KEY (id);


--
-- TOC entry 3978 (class 2606 OID 17723)
-- Name: product_media_links product_media_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_media_links
    ADD CONSTRAINT product_media_links_pkey PRIMARY KEY (id);


--
-- TOC entry 3980 (class 2606 OID 17725)
-- Name: product_media_links product_media_links_product_id_media_file_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_media_links
    ADD CONSTRAINT product_media_links_product_id_media_file_id_key UNIQUE (product_id, media_file_id);


--
-- TOC entry 4101 (class 2606 OID 18654)
-- Name: product_selection_tables product_selection_tables_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_selection_tables
    ADD CONSTRAINT product_selection_tables_pkey PRIMARY KEY (id);


--
-- TOC entry 3913 (class 2606 OID 16613)
-- Name: product_sizes product_sizes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_sizes
    ADD CONSTRAINT product_sizes_pkey PRIMARY KEY (id);


--
-- TOC entry 4090 (class 2606 OID 18441)
-- Name: product_suppliers product_suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_suppliers
    ADD CONSTRAINT product_suppliers_pkey PRIMARY KEY (variant_id, supplier_id);


--
-- TOC entry 4080 (class 2606 OID 18416)
-- Name: product_variants product_variants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_variants
    ADD CONSTRAINT product_variants_pkey PRIMARY KEY (id);


--
-- TOC entry 4082 (class 2606 OID 18418)
-- Name: product_variants product_variants_sku_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_variants
    ADD CONSTRAINT product_variants_sku_key UNIQUE (sku);


--
-- TOC entry 3892 (class 2606 OID 16526)
-- Name: product_view_stats product_view_stats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_view_stats
    ADD CONSTRAINT product_view_stats_pkey PRIMARY KEY (id);


--
-- TOC entry 3894 (class 2606 OID 16528)
-- Name: product_view_stats product_view_stats_product_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_view_stats
    ADD CONSTRAINT product_view_stats_product_id_key UNIQUE (product_id);


--
-- TOC entry 3888 (class 2606 OID 16460)
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- TOC entry 4028 (class 2606 OID 18193)
-- Name: roles roles_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_name_key UNIQUE (name);


--
-- TOC entry 4030 (class 2606 OID 18191)
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- TOC entry 3944 (class 2606 OID 17491)
-- Name: site_menu site_menu_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_menu
    ADD CONSTRAINT site_menu_pkey PRIMARY KEY (id);


--
-- TOC entry 3874 (class 2606 OID 16403)
-- Name: site_settings site_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_settings
    ADD CONSTRAINT site_settings_pkey PRIMARY KEY (id);


--
-- TOC entry 3926 (class 2606 OID 16655)
-- Name: size_chart_values size_chart_values_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.size_chart_values
    ADD CONSTRAINT size_chart_values_pkey PRIMARY KEY (id);


--
-- TOC entry 3920 (class 2606 OID 16639)
-- Name: size_charts size_charts_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.size_charts
    ADD CONSTRAINT size_charts_name_key UNIQUE (name);


--
-- TOC entry 3922 (class 2606 OID 16637)
-- Name: size_charts size_charts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.size_charts
    ADD CONSTRAINT size_charts_pkey PRIMARY KEY (id);


--
-- TOC entry 3939 (class 2606 OID 16727)
-- Name: characteristic_values_legacy spec_enums_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.characteristic_values_legacy
    ADD CONSTRAINT spec_enums_pkey PRIMARY KEY (id);


--
-- TOC entry 3933 (class 2606 OID 16706)
-- Name: characteristic_groups_legacy spec_groups_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.characteristic_groups_legacy
    ADD CONSTRAINT spec_groups_name_key UNIQUE (name);


--
-- TOC entry 3935 (class 2606 OID 16704)
-- Name: characteristic_groups_legacy spec_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.characteristic_groups_legacy
    ADD CONSTRAINT spec_groups_pkey PRIMARY KEY (id);


--
-- TOC entry 4086 (class 2606 OID 18435)
-- Name: suppliers suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_pkey PRIMARY KEY (id);


--
-- TOC entry 3955 (class 2606 OID 18160)
-- Name: product_categories unique_category_name_parent; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_categories
    ADD CONSTRAINT unique_category_name_parent UNIQUE (name, parent_id);


--
-- TOC entry 3928 (class 2606 OID 16662)
-- Name: size_chart_values unique_chart_size; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.size_chart_values
    ADD CONSTRAINT unique_chart_size UNIQUE (size_chart_id, size_name);


--
-- TOC entry 3890 (class 2606 OID 18158)
-- Name: products unique_product_name_manufacturer; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT unique_product_name_manufacturer UNIQUE (name, manufacturer_id);


--
-- TOC entry 3915 (class 2606 OID 16620)
-- Name: product_sizes unique_product_size; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_sizes
    ADD CONSTRAINT unique_product_size UNIQUE (product_id, size_name);


--
-- TOC entry 4103 (class 2606 OID 18664)
-- Name: product_selection_tables unique_product_table_type; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_selection_tables
    ADD CONSTRAINT unique_product_table_type UNIQUE (product_id, table_type);


--
-- TOC entry 3917 (class 2606 OID 16622)
-- Name: product_sizes unique_sku; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_sizes
    ADD CONSTRAINT unique_sku UNIQUE (sku);


--
-- TOC entry 4052 (class 2606 OID 18249)
-- Name: user_audit_log user_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_audit_log
    ADD CONSTRAINT user_audit_log_pkey PRIMARY KEY (id);


--
-- TOC entry 4046 (class 2606 OID 18234)
-- Name: user_sessions user_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_pkey PRIMARY KEY (id);


--
-- TOC entry 4037 (class 2606 OID 18214)
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- TOC entry 4039 (class 2606 OID 18210)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 4041 (class 2606 OID 18212)
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- TOC entry 4134 (class 2606 OID 19500)
-- Name: variant_attribute_types variant_attribute_types_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.variant_attribute_types
    ADD CONSTRAINT variant_attribute_types_code_key UNIQUE (code);


--
-- TOC entry 4136 (class 2606 OID 19498)
-- Name: variant_attribute_types variant_attribute_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.variant_attribute_types
    ADD CONSTRAINT variant_attribute_types_pkey PRIMARY KEY (id);


--
-- TOC entry 4138 (class 2606 OID 19514)
-- Name: variant_attribute_values variant_attribute_values_attribute_type_id_value_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.variant_attribute_values
    ADD CONSTRAINT variant_attribute_values_attribute_type_id_value_key UNIQUE (attribute_type_id, value);


--
-- TOC entry 4140 (class 2606 OID 19512)
-- Name: variant_attribute_values variant_attribute_values_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.variant_attribute_values
    ADD CONSTRAINT variant_attribute_values_pkey PRIMARY KEY (id);


--
-- TOC entry 4167 (class 2606 OID 19742)
-- Name: variant_attributes_new variant_attributes_new_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.variant_attributes_new
    ADD CONSTRAINT variant_attributes_new_pkey PRIMARY KEY (id);


--
-- TOC entry 4169 (class 2606 OID 19744)
-- Name: variant_attributes_new variant_attributes_new_variant_id_attribute_type_id_attribu_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.variant_attributes_new
    ADD CONSTRAINT variant_attributes_new_variant_id_attribute_type_id_attribu_key UNIQUE (variant_id, attribute_type_id, attribute_value_id);


--
-- TOC entry 4145 (class 2606 OID 19532)
-- Name: variant_characteristics variant_characteristics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.variant_characteristics
    ADD CONSTRAINT variant_characteristics_pkey PRIMARY KEY (id);


--
-- TOC entry 4130 (class 2606 OID 19117)
-- Name: variant_characteristics_simple variant_characteristics_simple_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.variant_characteristics_simple
    ADD CONSTRAINT variant_characteristics_simple_pkey PRIMARY KEY (id);


--
-- TOC entry 4132 (class 2606 OID 19119)
-- Name: variant_characteristics_simple variant_characteristics_simple_variant_id_value_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.variant_characteristics_simple
    ADD CONSTRAINT variant_characteristics_simple_variant_id_value_id_key UNIQUE (variant_id, value_id);


--
-- TOC entry 4147 (class 2606 OID 19534)
-- Name: variant_characteristics variant_characteristics_variant_id_template_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.variant_characteristics
    ADD CONSTRAINT variant_characteristics_variant_id_template_id_key UNIQUE (variant_id, template_id);


--
-- TOC entry 4152 (class 2606 OID 19560)
-- Name: variant_images variant_images_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.variant_images
    ADD CONSTRAINT variant_images_pkey PRIMARY KEY (id);


--
-- TOC entry 4154 (class 2606 OID 19578)
-- Name: variant_price_tiers variant_price_tiers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.variant_price_tiers
    ADD CONSTRAINT variant_price_tiers_pkey PRIMARY KEY (id);


--
-- TOC entry 4156 (class 2606 OID 19580)
-- Name: variant_price_tiers variant_price_tiers_variant_id_user_group_min_quantity_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.variant_price_tiers
    ADD CONSTRAINT variant_price_tiers_variant_id_user_group_min_quantity_key UNIQUE (variant_id, user_group, min_quantity);


--
-- TOC entry 4024 (class 2606 OID 18134)
-- Name: warehouse_articles warehouse_articles_article_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse_articles
    ADD CONSTRAINT warehouse_articles_article_code_key UNIQUE (article_code);


--
-- TOC entry 4026 (class 2606 OID 18132)
-- Name: warehouse_articles warehouse_articles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse_articles
    ADD CONSTRAINT warehouse_articles_pkey PRIMARY KEY (id);


--
-- TOC entry 4013 (class 2606 OID 18086)
-- Name: warehouse_cities warehouse_cities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse_cities
    ADD CONSTRAINT warehouse_cities_pkey PRIMARY KEY (id);


--
-- TOC entry 4015 (class 2606 OID 18088)
-- Name: warehouse_cities warehouse_cities_region_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse_cities
    ADD CONSTRAINT warehouse_cities_region_id_code_key UNIQUE (region_id, code);


--
-- TOC entry 3999 (class 2606 OID 18011)
-- Name: warehouse_inventory warehouse_inventory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse_inventory
    ADD CONSTRAINT warehouse_inventory_pkey PRIMARY KEY (id);


--
-- TOC entry 4001 (class 2606 OID 18013)
-- Name: warehouse_inventory warehouse_inventory_sku_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse_inventory
    ADD CONSTRAINT warehouse_inventory_sku_key UNIQUE (sku);


--
-- TOC entry 4004 (class 2606 OID 18034)
-- Name: warehouse_movements warehouse_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse_movements
    ADD CONSTRAINT warehouse_movements_pkey PRIMARY KEY (id);


--
-- TOC entry 4007 (class 2606 OID 18074)
-- Name: warehouse_regions warehouse_regions_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse_regions
    ADD CONSTRAINT warehouse_regions_code_key UNIQUE (code);


--
-- TOC entry 4009 (class 2606 OID 18072)
-- Name: warehouse_regions warehouse_regions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse_regions
    ADD CONSTRAINT warehouse_regions_pkey PRIMARY KEY (id);


--
-- TOC entry 3993 (class 2606 OID 17988)
-- Name: warehouse_sections warehouse_sections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse_sections
    ADD CONSTRAINT warehouse_sections_pkey PRIMARY KEY (id);


--
-- TOC entry 3995 (class 2606 OID 17990)
-- Name: warehouse_sections warehouse_sections_zone_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse_sections
    ADD CONSTRAINT warehouse_sections_zone_id_name_key UNIQUE (zone_id, name);


--
-- TOC entry 4054 (class 2606 OID 18285)
-- Name: warehouse_settings warehouse_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse_settings
    ADD CONSTRAINT warehouse_settings_pkey PRIMARY KEY (id);


--
-- TOC entry 4056 (class 2606 OID 18287)
-- Name: warehouse_settings warehouse_settings_setting_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse_settings
    ADD CONSTRAINT warehouse_settings_setting_key_key UNIQUE (setting_key);


--
-- TOC entry 4019 (class 2606 OID 18109)
-- Name: warehouse_warehouses warehouse_warehouses_city_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse_warehouses
    ADD CONSTRAINT warehouse_warehouses_city_id_code_key UNIQUE (city_id, code);


--
-- TOC entry 4021 (class 2606 OID 18107)
-- Name: warehouse_warehouses warehouse_warehouses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse_warehouses
    ADD CONSTRAINT warehouse_warehouses_pkey PRIMARY KEY (id);


--
-- TOC entry 3987 (class 2606 OID 17975)
-- Name: warehouse_zones warehouse_zones_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse_zones
    ADD CONSTRAINT warehouse_zones_name_key UNIQUE (name);


--
-- TOC entry 3989 (class 2606 OID 17973)
-- Name: warehouse_zones warehouse_zones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse_zones
    ADD CONSTRAINT warehouse_zones_pkey PRIMARY KEY (id);


--
-- TOC entry 4123 (class 1259 OID 19047)
-- Name: idx_catalog_files_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_catalog_files_active ON public.catalog_files USING btree (is_active);


--
-- TOC entry 4124 (class 1259 OID 19048)
-- Name: idx_catalog_files_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_catalog_files_created_at ON public.catalog_files USING btree (created_at);


--
-- TOC entry 4125 (class 1259 OID 19046)
-- Name: idx_catalog_files_year; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_catalog_files_year ON public.catalog_files USING btree (year);


--
-- TOC entry 3960 (class 1259 OID 17586)
-- Name: idx_catalog_menu_settings_hierarchy; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_catalog_menu_settings_hierarchy ON public.catalog_menu_settings USING btree (parent_id, sort_order);


--
-- TOC entry 3947 (class 1259 OID 17557)
-- Name: idx_categories_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_categories_active ON public.product_categories USING btree (is_active);


--
-- TOC entry 3948 (class 1259 OID 18167)
-- Name: idx_categories_name_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_categories_name_gin ON public.product_categories USING gin (to_tsvector('russian'::regconfig, (name)::text));


--
-- TOC entry 3949 (class 1259 OID 17555)
-- Name: idx_categories_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_categories_parent ON public.product_categories USING btree (parent_id);


--
-- TOC entry 3950 (class 1259 OID 17890)
-- Name: idx_categories_parent_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_categories_parent_active ON public.product_categories USING btree (parent_id, is_active) WHERE (is_active = true);


--
-- TOC entry 3951 (class 1259 OID 18169)
-- Name: idx_categories_parent_hierarchy; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_categories_parent_hierarchy ON public.product_categories USING btree (parent_id, sort_order, name) WHERE (parent_id IS NOT NULL);


--
-- TOC entry 3952 (class 1259 OID 17556)
-- Name: idx_categories_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_categories_type ON public.product_categories USING btree (type);


--
-- TOC entry 3953 (class 1259 OID 17891)
-- Name: idx_categories_type_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_categories_type_active ON public.product_categories USING btree (type, is_active) WHERE (is_active = true);


--
-- TOC entry 4161 (class 1259 OID 19731)
-- Name: idx_category_attribute_types_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_category_attribute_types_category ON public.category_attribute_types USING btree (category_id);


--
-- TOC entry 4162 (class 1259 OID 19732)
-- Name: idx_category_attribute_types_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_category_attribute_types_type ON public.category_attribute_types USING btree (attribute_type_id);


--
-- TOC entry 3929 (class 1259 OID 18335)
-- Name: idx_characteristic_groups_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_characteristic_groups_is_active ON public.characteristic_groups_legacy USING btree (is_active);


--
-- TOC entry 3930 (class 1259 OID 18601)
-- Name: idx_characteristic_groups_is_section; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_characteristic_groups_is_section ON public.characteristic_groups_legacy USING btree (is_section);


--
-- TOC entry 3931 (class 1259 OID 18334)
-- Name: idx_characteristic_groups_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_characteristic_groups_name ON public.characteristic_groups_legacy USING btree (name);


--
-- TOC entry 4066 (class 1259 OID 18399)
-- Name: idx_characteristic_preset_values_template_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_characteristic_preset_values_template_id ON public.characteristic_preset_values USING btree (template_id);


--
-- TOC entry 3936 (class 1259 OID 18337)
-- Name: idx_characteristic_values_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_characteristic_values_is_active ON public.characteristic_values_legacy USING btree (is_active);


--
-- TOC entry 3937 (class 1259 OID 18336)
-- Name: idx_characteristic_values_value; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_characteristic_values_value ON public.characteristic_values_legacy USING btree (value);


--
-- TOC entry 4106 (class 1259 OID 18935)
-- Name: idx_characteristics_groups_simple_hierarchy; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_characteristics_groups_simple_hierarchy ON public.characteristics_groups_simple USING btree (parent_id, sort_order) WHERE (parent_id IS NOT NULL);


--
-- TOC entry 4107 (class 1259 OID 18932)
-- Name: idx_characteristics_groups_simple_performance; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_characteristics_groups_simple_performance ON public.characteristics_groups_simple USING btree (is_active, sort_order, show_in_main_params) WHERE (is_active = true);


--
-- TOC entry 4110 (class 1259 OID 18808)
-- Name: idx_characteristics_values_group_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_characteristics_values_group_id ON public.characteristics_values_simple USING btree (group_id);


--
-- TOC entry 4111 (class 1259 OID 18933)
-- Name: idx_characteristics_values_simple_performance; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_characteristics_values_simple_performance ON public.characteristics_values_simple USING btree (group_id, is_active, sort_order) WHERE (is_active = true);


--
-- TOC entry 3901 (class 1259 OID 16592)
-- Name: idx_manufacturers_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_manufacturers_name ON public.manufacturers USING btree (name);


--
-- TOC entry 3965 (class 1259 OID 17892)
-- Name: idx_media_files_active_recent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_media_files_active_recent ON public.media_files USING btree (created_at DESC) WHERE (upload_count > 0);


--
-- TOC entry 3966 (class 1259 OID 17738)
-- Name: idx_media_files_extension; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_media_files_extension ON public.media_files USING btree (file_extension);


--
-- TOC entry 3967 (class 1259 OID 17736)
-- Name: idx_media_files_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_media_files_hash ON public.media_files USING btree (file_hash);


--
-- TOC entry 3968 (class 1259 OID 17737)
-- Name: idx_media_files_size; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_media_files_size ON public.media_files USING btree (file_size);


--
-- TOC entry 3969 (class 1259 OID 17739)
-- Name: idx_media_files_upload_count; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_media_files_upload_count ON public.media_files USING btree (upload_count);


--
-- TOC entry 3895 (class 1259 OID 16575)
-- Name: idx_model_lines_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_model_lines_category ON public.model_series USING btree (category_id);


--
-- TOC entry 3896 (class 1259 OID 17886)
-- Name: idx_model_lines_manufacturer_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_model_lines_manufacturer_active ON public.model_series USING btree (manufacturer_id, is_active) WHERE (is_active = true);


--
-- TOC entry 4059 (class 1259 OID 18961)
-- Name: idx_order_items_article_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_items_article_number ON public.order_items USING btree (article_number);


--
-- TOC entry 4060 (class 1259 OID 18960)
-- Name: idx_order_items_sku; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_items_sku ON public.order_items USING btree (sku);


--
-- TOC entry 4061 (class 1259 OID 19834)
-- Name: idx_order_items_variant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_items_variant_id ON public.order_items USING btree (variant_id);


--
-- TOC entry 4091 (class 1259 OID 18570)
-- Name: idx_price_logs_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_price_logs_date ON public.price_logs USING btree (start_date, end_date);


--
-- TOC entry 4092 (class 1259 OID 18569)
-- Name: idx_price_logs_variant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_price_logs_variant ON public.price_logs USING btree (variant_id);


--
-- TOC entry 4112 (class 1259 OID 18809)
-- Name: idx_product_characteristics_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_characteristics_product_id ON public.product_characteristics_simple USING btree (product_id);


--
-- TOC entry 4113 (class 1259 OID 18934)
-- Name: idx_product_characteristics_simple_performance; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_characteristics_simple_performance ON public.product_characteristics_simple USING btree (product_id, value_id, is_primary, display_order);


--
-- TOC entry 4114 (class 1259 OID 18810)
-- Name: idx_product_characteristics_value_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_characteristics_value_id ON public.product_characteristics_simple USING btree (value_id);


--
-- TOC entry 3961 (class 1259 OID 17676)
-- Name: idx_product_images_main; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_images_main ON public.product_images USING btree (product_id, is_main);


--
-- TOC entry 3962 (class 1259 OID 17675)
-- Name: idx_product_images_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_images_order ON public.product_images USING btree (product_id, image_order);


--
-- TOC entry 3974 (class 1259 OID 17742)
-- Name: idx_product_media_links_main; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_media_links_main ON public.product_media_links USING btree (is_main) WHERE (is_main = true);


--
-- TOC entry 3975 (class 1259 OID 17741)
-- Name: idx_product_media_links_media; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_media_links_media ON public.product_media_links USING btree (media_file_id);


--
-- TOC entry 3976 (class 1259 OID 17740)
-- Name: idx_product_media_links_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_media_links_product ON public.product_media_links USING btree (product_id);


--
-- TOC entry 4097 (class 1259 OID 18660)
-- Name: idx_product_selection_tables_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_selection_tables_product_id ON public.product_selection_tables USING btree (product_id);


--
-- TOC entry 4098 (class 1259 OID 18661)
-- Name: idx_product_selection_tables_sku; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_selection_tables_sku ON public.product_selection_tables USING btree (sku);


--
-- TOC entry 4099 (class 1259 OID 18662)
-- Name: idx_product_selection_tables_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_selection_tables_type ON public.product_selection_tables USING btree (table_type);


--
-- TOC entry 3904 (class 1259 OID 16664)
-- Name: idx_product_sizes_available; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_sizes_available ON public.product_sizes USING btree (is_available);


--
-- TOC entry 3905 (class 1259 OID 19068)
-- Name: idx_product_sizes_discount_price; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_sizes_discount_price ON public.product_sizes USING btree (discount_price) WHERE (discount_price IS NOT NULL);


--
-- TOC entry 3906 (class 1259 OID 19079)
-- Name: idx_product_sizes_is_bestseller; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_sizes_is_bestseller ON public.product_sizes USING btree (is_bestseller) WHERE (is_bestseller = true);


--
-- TOC entry 3907 (class 1259 OID 19077)
-- Name: idx_product_sizes_is_featured; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_sizes_is_featured ON public.product_sizes USING btree (is_featured) WHERE (is_featured = true);


--
-- TOC entry 3908 (class 1259 OID 19078)
-- Name: idx_product_sizes_is_new; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_sizes_is_new ON public.product_sizes USING btree (is_new) WHERE (is_new = true);


--
-- TOC entry 3909 (class 1259 OID 19076)
-- Name: idx_product_sizes_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_sizes_name ON public.product_sizes USING btree (name);


--
-- TOC entry 3910 (class 1259 OID 16663)
-- Name: idx_product_sizes_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_sizes_product ON public.product_sizes USING btree (product_id);


--
-- TOC entry 3911 (class 1259 OID 16665)
-- Name: idx_product_sizes_sku; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_sizes_sku ON public.product_sizes USING btree (sku);


--
-- TOC entry 4087 (class 1259 OID 18568)
-- Name: idx_product_suppliers_supplier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_suppliers_supplier ON public.product_suppliers USING btree (supplier_id);


--
-- TOC entry 4088 (class 1259 OID 18567)
-- Name: idx_product_suppliers_variant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_suppliers_variant ON public.product_suppliers USING btree (variant_id);


--
-- TOC entry 4067 (class 1259 OID 19481)
-- Name: idx_product_variants_attributes; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_variants_attributes ON public.product_variants USING gin (attributes);


--
-- TOC entry 4068 (class 1259 OID 19180)
-- Name: idx_product_variants_category_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_variants_category_id ON public.product_variants USING btree (category_id);


--
-- TOC entry 4069 (class 1259 OID 18564)
-- Name: idx_product_variants_deleted; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_variants_deleted ON public.product_variants USING btree (is_deleted);


--
-- TOC entry 4070 (class 1259 OID 19483)
-- Name: idx_product_variants_featured; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_variants_featured ON public.product_variants USING btree (is_featured) WHERE ((is_featured = true) AND (is_active = true));


--
-- TOC entry 4071 (class 1259 OID 19480)
-- Name: idx_product_variants_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_variants_is_active ON public.product_variants USING btree (is_active) WHERE (is_active = true);


--
-- TOC entry 4072 (class 1259 OID 18562)
-- Name: idx_product_variants_master_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_variants_master_id ON public.product_variants USING btree (master_id);


--
-- TOC entry 4073 (class 1259 OID 19163)
-- Name: idx_product_variants_master_sku; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_variants_master_sku ON public.product_variants USING btree (master_id, sku);


--
-- TOC entry 4074 (class 1259 OID 19160)
-- Name: idx_product_variants_migration; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_variants_migration ON public.product_variants USING btree (((attributes ->> 'migrated_from'::text))) WHERE ((attributes ->> 'migrated_from'::text) IS NOT NULL);


--
-- TOC entry 4075 (class 1259 OID 19161)
-- Name: idx_product_variants_original_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_variants_original_id ON public.product_variants USING btree (((attributes ->> 'original_id'::text))) WHERE ((attributes ->> 'original_id'::text) IS NOT NULL);


--
-- TOC entry 4076 (class 1259 OID 18563)
-- Name: idx_product_variants_sku; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_variants_sku ON public.product_variants USING btree (sku);


--
-- TOC entry 4077 (class 1259 OID 19479)
-- Name: idx_product_variants_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_variants_slug ON public.product_variants USING btree (slug) WHERE (slug IS NOT NULL);


--
-- TOC entry 4078 (class 1259 OID 19482)
-- Name: idx_product_variants_stock; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_variants_stock ON public.product_variants USING btree (stock_quantity) WHERE (is_active = true);


--
-- TOC entry 3875 (class 1259 OID 18168)
-- Name: idx_products_active_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_active_status ON public.products USING btree (in_stock, stock_status, price) WHERE ((in_stock = true) AND (price IS NOT NULL));


--
-- TOC entry 3876 (class 1259 OID 16534)
-- Name: idx_products_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_category ON public.products USING btree (category_id);


--
-- TOC entry 3877 (class 1259 OID 18164)
-- Name: idx_products_category_price; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_category_price ON public.products USING btree (category_id, price DESC) WHERE (price IS NOT NULL);


--
-- TOC entry 3878 (class 1259 OID 17884)
-- Name: idx_products_category_stock_performance; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_category_stock_performance ON public.products USING btree (category_id, in_stock, created_at DESC);


--
-- TOC entry 3879 (class 1259 OID 16547)
-- Name: idx_products_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_created_at ON public.products USING btree (created_at DESC);


--
-- TOC entry 3880 (class 1259 OID 18634)
-- Name: idx_products_fulltext_search; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_fulltext_search ON public.products USING gin (to_tsvector('russian'::regconfig, (((name)::text || ' '::text) || COALESCE(description, ''::text))));


--
-- TOC entry 3881 (class 1259 OID 16535)
-- Name: idx_products_in_stock; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_in_stock ON public.products USING btree (in_stock);


--
-- TOC entry 3882 (class 1259 OID 17885)
-- Name: idx_products_manufacturer_performance; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_manufacturer_performance ON public.products USING btree (manufacturer_id) WHERE (manufacturer_id IS NOT NULL);


--
-- TOC entry 3883 (class 1259 OID 18165)
-- Name: idx_products_manufacturer_stock; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_manufacturer_stock ON public.products USING btree (manufacturer_id, in_stock, stock_status) WHERE (manufacturer_id IS NOT NULL);


--
-- TOC entry 3884 (class 1259 OID 16577)
-- Name: idx_products_model_line; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_model_line ON public.products USING btree (model_line_id);


--
-- TOC entry 3885 (class 1259 OID 18722)
-- Name: idx_products_show_price; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_show_price ON public.products USING btree (show_price);


--
-- TOC entry 3886 (class 1259 OID 17960)
-- Name: idx_products_stock_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_stock_status ON public.products USING btree (stock_status);


--
-- TOC entry 3940 (class 1259 OID 17498)
-- Name: idx_site_menu_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_site_menu_is_active ON public.site_menu USING btree (is_active);


--
-- TOC entry 3941 (class 1259 OID 17497)
-- Name: idx_site_menu_sort_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_site_menu_sort_order ON public.site_menu USING btree (sort_order);


--
-- TOC entry 3942 (class 1259 OID 17499)
-- Name: idx_site_menu_spec_group_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_site_menu_spec_group_id ON public.site_menu USING btree (spec_group_id);


--
-- TOC entry 3923 (class 1259 OID 16669)
-- Name: idx_size_chart_values_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_size_chart_values_active ON public.size_chart_values USING btree (is_active);


--
-- TOC entry 3924 (class 1259 OID 16668)
-- Name: idx_size_chart_values_chart; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_size_chart_values_chart ON public.size_chart_values USING btree (size_chart_id);


--
-- TOC entry 3918 (class 1259 OID 16666)
-- Name: idx_size_charts_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_size_charts_category ON public.size_charts USING btree (category_id);


--
-- TOC entry 4083 (class 1259 OID 18566)
-- Name: idx_suppliers_deleted; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_suppliers_deleted ON public.suppliers USING btree (is_deleted);


--
-- TOC entry 4084 (class 1259 OID 18565)
-- Name: idx_suppliers_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_suppliers_name ON public.suppliers USING btree (name);


--
-- TOC entry 4047 (class 1259 OID 18264)
-- Name: idx_user_audit_log_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_audit_log_action ON public.user_audit_log USING btree (action);


--
-- TOC entry 4048 (class 1259 OID 18265)
-- Name: idx_user_audit_log_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_audit_log_created_at ON public.user_audit_log USING btree (created_at);


--
-- TOC entry 4049 (class 1259 OID 18266)
-- Name: idx_user_audit_log_resource; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_audit_log_resource ON public.user_audit_log USING btree (resource_type, resource_id);


--
-- TOC entry 4050 (class 1259 OID 18263)
-- Name: idx_user_audit_log_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_audit_log_user_id ON public.user_audit_log USING btree (user_id);


--
-- TOC entry 4042 (class 1259 OID 18261)
-- Name: idx_user_sessions_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_sessions_expires_at ON public.user_sessions USING btree (expires_at);


--
-- TOC entry 4043 (class 1259 OID 18262)
-- Name: idx_user_sessions_last_activity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_sessions_last_activity ON public.user_sessions USING btree (last_activity);


--
-- TOC entry 4044 (class 1259 OID 18260)
-- Name: idx_user_sessions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_sessions_user_id ON public.user_sessions USING btree (user_id);


--
-- TOC entry 4031 (class 1259 OID 18256)
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- TOC entry 4032 (class 1259 OID 18259)
-- Name: idx_users_last_login; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_last_login ON public.users USING btree (last_login);


--
-- TOC entry 4033 (class 1259 OID 18257)
-- Name: idx_users_role_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_role_id ON public.users USING btree (role_id);


--
-- TOC entry 4034 (class 1259 OID 18258)
-- Name: idx_users_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_status ON public.users USING btree (status);


--
-- TOC entry 4035 (class 1259 OID 18255)
-- Name: idx_users_username; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_username ON public.users USING btree (username);


--
-- TOC entry 4163 (class 1259 OID 19761)
-- Name: idx_variant_attributes_new_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_variant_attributes_new_type ON public.variant_attributes_new USING btree (attribute_type_id);


--
-- TOC entry 4164 (class 1259 OID 19762)
-- Name: idx_variant_attributes_new_value; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_variant_attributes_new_value ON public.variant_attributes_new USING btree (attribute_value_id);


--
-- TOC entry 4165 (class 1259 OID 19760)
-- Name: idx_variant_attributes_new_variant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_variant_attributes_new_variant ON public.variant_attributes_new USING btree (variant_id);


--
-- TOC entry 4126 (class 1259 OID 19162)
-- Name: idx_variant_characteristics_composite; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_variant_characteristics_composite ON public.variant_characteristics_simple USING btree (variant_id, value_id);


--
-- TOC entry 4141 (class 1259 OID 19547)
-- Name: idx_variant_characteristics_highlighted; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_variant_characteristics_highlighted ON public.variant_characteristics USING btree (is_highlighted) WHERE (is_highlighted = true);


--
-- TOC entry 4127 (class 1259 OID 19131)
-- Name: idx_variant_characteristics_simple_value; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_variant_characteristics_simple_value ON public.variant_characteristics_simple USING btree (value_id);


--
-- TOC entry 4128 (class 1259 OID 19130)
-- Name: idx_variant_characteristics_simple_variant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_variant_characteristics_simple_variant ON public.variant_characteristics_simple USING btree (variant_id);


--
-- TOC entry 4142 (class 1259 OID 19546)
-- Name: idx_variant_characteristics_template; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_variant_characteristics_template ON public.variant_characteristics USING btree (template_id);


--
-- TOC entry 4143 (class 1259 OID 19545)
-- Name: idx_variant_characteristics_variant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_variant_characteristics_variant ON public.variant_characteristics USING btree (variant_id);


--
-- TOC entry 4148 (class 1259 OID 19568)
-- Name: idx_variant_images_primary; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_variant_images_primary ON public.variant_images USING btree (variant_id, is_primary) WHERE (is_primary = true);


--
-- TOC entry 4149 (class 1259 OID 19567)
-- Name: idx_variant_images_variant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_variant_images_variant ON public.variant_images USING btree (variant_id);


--
-- TOC entry 4022 (class 1259 OID 18145)
-- Name: idx_warehouse_articles_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_warehouse_articles_code ON public.warehouse_articles USING btree (article_code);


--
-- TOC entry 4010 (class 1259 OID 18272)
-- Name: idx_warehouse_cities_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_warehouse_cities_active ON public.warehouse_cities USING btree (is_active);


--
-- TOC entry 4011 (class 1259 OID 18140)
-- Name: idx_warehouse_cities_region; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_warehouse_cities_region ON public.warehouse_cities USING btree (region_id);


--
-- TOC entry 3996 (class 1259 OID 18055)
-- Name: idx_warehouse_inventory_section; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_warehouse_inventory_section ON public.warehouse_inventory USING btree (section_id);


--
-- TOC entry 3997 (class 1259 OID 18057)
-- Name: idx_warehouse_inventory_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_warehouse_inventory_status ON public.warehouse_inventory USING btree (status);


--
-- TOC entry 4002 (class 1259 OID 18058)
-- Name: idx_warehouse_movements_inventory; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_warehouse_movements_inventory ON public.warehouse_movements USING btree (inventory_id);


--
-- TOC entry 4005 (class 1259 OID 18271)
-- Name: idx_warehouse_regions_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_warehouse_regions_active ON public.warehouse_regions USING btree (is_active);


--
-- TOC entry 3990 (class 1259 OID 18053)
-- Name: idx_warehouse_sections_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_warehouse_sections_active ON public.warehouse_sections USING btree (is_active);


--
-- TOC entry 3991 (class 1259 OID 18052)
-- Name: idx_warehouse_sections_zone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_warehouse_sections_zone ON public.warehouse_sections USING btree (zone_id);


--
-- TOC entry 4016 (class 1259 OID 18273)
-- Name: idx_warehouse_warehouses_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_warehouse_warehouses_active ON public.warehouse_warehouses USING btree (is_active);


--
-- TOC entry 4017 (class 1259 OID 18141)
-- Name: idx_warehouse_warehouses_city; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_warehouse_warehouses_city ON public.warehouse_warehouses USING btree (city_id);


--
-- TOC entry 3983 (class 1259 OID 18051)
-- Name: idx_warehouse_zones_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_warehouse_zones_active ON public.warehouse_zones USING btree (is_active);


--
-- TOC entry 3984 (class 1259 OID 18050)
-- Name: idx_warehouse_zones_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_warehouse_zones_location ON public.warehouse_zones USING btree (location);


--
-- TOC entry 3985 (class 1259 OID 18142)
-- Name: idx_warehouse_zones_warehouse; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_warehouse_zones_warehouse ON public.warehouse_zones USING btree (warehouse_id);


--
-- TOC entry 4150 (class 1259 OID 19566)
-- Name: unique_primary_image_per_variant; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX unique_primary_image_per_variant ON public.variant_images USING btree (variant_id) WHERE (is_primary = true);


--
-- TOC entry 4396 (class 2618 OID 19589)
-- Name: v_product_variants_full _RETURN; Type: RULE; Schema: public; Owner: -
--

CREATE OR REPLACE VIEW public.v_product_variants_full AS
 SELECT pv.id,
    pv.master_id,
    pv.sku,
    pv.price_override,
    pv.stock_override,
    pv.attributes_json,
    pv.created_at,
    pv.updated_at,
    pv.is_deleted,
    pv.slug,
    pv.name,
    pv.description,
    pv.short_description,
    pv.cost_price,
    pv.reserved_quantity,
    pv.min_stock_level,
    pv.max_stock_level,
    pv.weight,
    pv.length,
    pv.width,
    pv.height,
    pv.primary_image_url,
    pv.images,
    pv.videos,
    pv.documents,
    pv.attributes,
    pv.meta_title,
    pv.meta_description,
    pv.meta_keywords,
    pv.is_featured,
    pv.is_new,
    pv.is_bestseller,
    pv.is_recommended,
    pv.warranty_months,
    pv.battery_life_hours,
    pv.custom_fields,
    pv.is_active,
    pv.price,
    pv.discount_price,
    pv.stock_quantity,
    pv.sort_order,
    pv.category_id,
    pv.stock_status,
    pv.show_price,
    pv.short_name,
    p.name AS master_name,
    p.manufacturer_id,
    p.series_id,
    pc.name AS category_name,
    m.name AS manufacturer_name,
    ms.name AS series_name,
    COALESCE((pv.stock_quantity - pv.reserved_quantity), 0) AS available_stock,
        CASE
            WHEN ((pv.stock_quantity > 0) AND pv.is_active) THEN true
            ELSE false
        END AS in_stock,
    count(DISTINCT vi.id) AS image_count,
    count(DISTINCT vc.id) AS characteristic_count
   FROM ((((((public.product_variants pv
     JOIN public.products p ON ((pv.master_id = p.id)))
     LEFT JOIN public.product_categories pc ON ((p.category_id = pc.id)))
     LEFT JOIN public.manufacturers m ON ((p.manufacturer_id = m.id)))
     LEFT JOIN public.model_series ms ON ((p.series_id = ms.id)))
     LEFT JOIN public.variant_images vi ON ((pv.id = vi.variant_id)))
     LEFT JOIN public.variant_characteristics vc ON ((pv.id = vc.variant_id)))
  WHERE (pv.is_deleted = false)
  GROUP BY pv.id, p.id, pc.id, m.id, ms.id;


--
-- TOC entry 4241 (class 2620 OID 18920)
-- Name: characteristics_groups_simple trg_characteristics_groups_simple_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_characteristics_groups_simple_updated_at BEFORE UPDATE ON public.characteristics_groups_simple FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 4242 (class 2620 OID 18921)
-- Name: characteristics_values_simple trg_characteristics_values_simple_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_characteristics_values_simple_updated_at BEFORE UPDATE ON public.characteristics_values_simple FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 4243 (class 2620 OID 18922)
-- Name: product_characteristics_simple trg_product_characteristics_simple_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_product_characteristics_simple_updated_at BEFORE UPDATE ON public.product_characteristics_simple FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 4235 (class 2620 OID 17587)
-- Name: catalog_menu_settings trigger_update_catalog_menu_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_catalog_menu_settings_updated_at BEFORE UPDATE ON public.catalog_menu_settings FOR EACH ROW EXECUTE FUNCTION public.update_catalog_menu_settings_updated_at();


--
-- TOC entry 4236 (class 2620 OID 17744)
-- Name: media_files trigger_update_media_files_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_media_files_updated_at BEFORE UPDATE ON public.media_files FOR EACH ROW EXECUTE FUNCTION public.update_media_files_updated_at();


--
-- TOC entry 4233 (class 2620 OID 18705)
-- Name: characteristic_groups_legacy update_characteristic_groups_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_characteristic_groups_updated_at BEFORE UPDATE ON public.characteristic_groups_legacy FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 4230 (class 2620 OID 18700)
-- Name: manufacturers update_manufacturers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_manufacturers_updated_at BEFORE UPDATE ON public.manufacturers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 4229 (class 2620 OID 18701)
-- Name: model_series update_model_series_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_model_series_updated_at BEFORE UPDATE ON public.model_series FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 4234 (class 2620 OID 18702)
-- Name: product_categories update_product_categories_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_product_categories_updated_at BEFORE UPDATE ON public.product_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 4231 (class 2620 OID 16670)
-- Name: product_sizes update_product_sizes_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_product_sizes_updated_at BEFORE UPDATE ON public.product_sizes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 4239 (class 2620 OID 19592)
-- Name: product_variants update_product_variants_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_product_variants_updated_at BEFORE UPDATE ON public.product_variants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 4228 (class 2620 OID 16544)
-- Name: products update_products_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 4237 (class 2620 OID 18268)
-- Name: roles update_roles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_roles_updated_at BEFORE UPDATE ON public.roles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 4227 (class 2620 OID 16540)
-- Name: site_settings update_site_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_site_settings_updated_at BEFORE UPDATE ON public.site_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 4232 (class 2620 OID 16671)
-- Name: size_charts update_size_charts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_size_charts_updated_at BEFORE UPDATE ON public.size_charts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 4240 (class 2620 OID 18704)
-- Name: suppliers update_suppliers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 4238 (class 2620 OID 18267)
-- Name: users update_users_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 4244 (class 2620 OID 19133)
-- Name: variant_characteristics_simple update_variant_characteristics_simple_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_variant_characteristics_simple_updated_at BEFORE UPDATE ON public.variant_characteristics_simple FOR EACH ROW EXECUTE FUNCTION public.update_variant_characteristics_simple_updated_at();


--
-- TOC entry 4245 (class 2620 OID 19593)
-- Name: variant_characteristics update_variant_characteristics_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_variant_characteristics_updated_at BEFORE UPDATE ON public.variant_characteristics FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 4214 (class 2606 OID 19041)
-- Name: catalog_files catalog_files_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalog_files
    ADD CONSTRAINT catalog_files_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 4184 (class 2606 OID 17577)
-- Name: catalog_menu_settings catalog_menu_settings_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalog_menu_settings
    ADD CONSTRAINT catalog_menu_settings_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.catalog_menu_settings(id) ON DELETE CASCADE;


--
-- TOC entry 4183 (class 2606 OID 17550)
-- Name: product_categories categories_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_categories
    ADD CONSTRAINT categories_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.product_categories(id) ON DELETE SET NULL;


--
-- TOC entry 4222 (class 2606 OID 19726)
-- Name: category_attribute_types category_attribute_types_attribute_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category_attribute_types
    ADD CONSTRAINT category_attribute_types_attribute_type_id_fkey FOREIGN KEY (attribute_type_id) REFERENCES public.variant_attribute_types(id) ON DELETE CASCADE;


--
-- TOC entry 4223 (class 2606 OID 19721)
-- Name: category_attribute_types category_attribute_types_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category_attribute_types
    ADD CONSTRAINT category_attribute_types_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.product_categories(id) ON DELETE CASCADE;


--
-- TOC entry 4180 (class 2606 OID 18329)
-- Name: characteristic_values_legacy characteristic_values_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.characteristic_values_legacy
    ADD CONSTRAINT characteristic_values_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.characteristic_groups_legacy(id);


--
-- TOC entry 4211 (class 2606 OID 18780)
-- Name: characteristics_values_simple characteristics_values_simple_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.characteristics_values_simple
    ADD CONSTRAINT characteristics_values_simple_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.characteristics_groups_simple(id) ON DELETE CASCADE;


--
-- TOC entry 4175 (class 2606 OID 16595)
-- Name: model_series fk_model_lines_manufacturer; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_series
    ADD CONSTRAINT fk_model_lines_manufacturer FOREIGN KEY (manufacturer_id) REFERENCES public.manufacturers(id);


--
-- TOC entry 4176 (class 2606 OID 18695)
-- Name: model_series fk_model_series_manufacturer; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_series
    ADD CONSTRAINT fk_model_series_manufacturer FOREIGN KEY (manufacturer_id) REFERENCES public.manufacturers(id);


--
-- TOC entry 4204 (class 2606 OID 19175)
-- Name: product_variants fk_product_variants_category; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_variants
    ADD CONSTRAINT fk_product_variants_category FOREIGN KEY (category_id) REFERENCES public.product_categories(id) ON DELETE SET NULL;


--
-- TOC entry 4170 (class 2606 OID 18576)
-- Name: products fk_products_category; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES public.product_categories(id);


--
-- TOC entry 4171 (class 2606 OID 17015)
-- Name: products fk_products_manufacturer; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT fk_products_manufacturer FOREIGN KEY (manufacturer_id) REFERENCES public.manufacturers(id);


--
-- TOC entry 4172 (class 2606 OID 18581)
-- Name: products fk_products_series; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT fk_products_series FOREIGN KEY (series_id) REFERENCES public.model_series(id);


--
-- TOC entry 4202 (class 2606 OID 18312)
-- Name: order_items order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- TOC entry 4203 (class 2606 OID 19829)
-- Name: order_items order_items_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id);


--
-- TOC entry 4208 (class 2606 OID 18461)
-- Name: price_logs price_logs_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.price_logs
    ADD CONSTRAINT price_logs_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id) ON DELETE CASCADE;


--
-- TOC entry 4209 (class 2606 OID 18552)
-- Name: product_certificates product_certificates_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_certificates
    ADD CONSTRAINT product_certificates_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id) ON DELETE CASCADE;


--
-- TOC entry 4212 (class 2606 OID 18798)
-- Name: product_characteristics_simple product_characteristics_simple_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_characteristics_simple
    ADD CONSTRAINT product_characteristics_simple_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- TOC entry 4213 (class 2606 OID 18803)
-- Name: product_characteristics_simple product_characteristics_simple_value_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_characteristics_simple
    ADD CONSTRAINT product_characteristics_simple_value_id_fkey FOREIGN KEY (value_id) REFERENCES public.characteristics_values_simple(id) ON DELETE CASCADE;


--
-- TOC entry 4185 (class 2606 OID 17669)
-- Name: product_images product_images_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_images
    ADD CONSTRAINT product_images_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- TOC entry 4186 (class 2606 OID 17731)
-- Name: product_media_links product_media_links_media_file_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_media_links
    ADD CONSTRAINT product_media_links_media_file_id_fkey FOREIGN KEY (media_file_id) REFERENCES public.media_files(id) ON DELETE CASCADE;


--
-- TOC entry 4187 (class 2606 OID 17726)
-- Name: product_media_links product_media_links_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_media_links
    ADD CONSTRAINT product_media_links_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- TOC entry 4210 (class 2606 OID 18655)
-- Name: product_selection_tables product_selection_tables_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_selection_tables
    ADD CONSTRAINT product_selection_tables_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- TOC entry 4177 (class 2606 OID 16614)
-- Name: product_sizes product_sizes_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_sizes
    ADD CONSTRAINT product_sizes_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- TOC entry 4206 (class 2606 OID 18447)
-- Name: product_suppliers product_suppliers_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_suppliers
    ADD CONSTRAINT product_suppliers_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE CASCADE;


--
-- TOC entry 4207 (class 2606 OID 18442)
-- Name: product_suppliers product_suppliers_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_suppliers
    ADD CONSTRAINT product_suppliers_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id) ON DELETE CASCADE;


--
-- TOC entry 4205 (class 2606 OID 18419)
-- Name: product_variants product_variants_master_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_variants
    ADD CONSTRAINT product_variants_master_id_fkey FOREIGN KEY (master_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- TOC entry 4174 (class 2606 OID 16529)
-- Name: product_view_stats product_view_stats_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_view_stats
    ADD CONSTRAINT product_view_stats_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- TOC entry 4173 (class 2606 OID 16570)
-- Name: products products_model_line_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_model_line_id_fkey FOREIGN KEY (model_line_id) REFERENCES public.model_series(id) ON DELETE SET NULL;


--
-- TOC entry 4182 (class 2606 OID 17492)
-- Name: site_menu site_menu_spec_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_menu
    ADD CONSTRAINT site_menu_spec_group_id_fkey FOREIGN KEY (spec_group_id) REFERENCES public.characteristic_groups_legacy(id) ON DELETE SET NULL;


--
-- TOC entry 4178 (class 2606 OID 16656)
-- Name: size_chart_values size_chart_values_size_chart_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.size_chart_values
    ADD CONSTRAINT size_chart_values_size_chart_id_fkey FOREIGN KEY (size_chart_id) REFERENCES public.size_charts(id) ON DELETE CASCADE;


--
-- TOC entry 4181 (class 2606 OID 16920)
-- Name: characteristic_values_legacy spec_enums_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.characteristic_values_legacy
    ADD CONSTRAINT spec_enums_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.characteristic_values_legacy(id);


--
-- TOC entry 4179 (class 2606 OID 17470)
-- Name: characteristic_groups_legacy spec_groups_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.characteristic_groups_legacy
    ADD CONSTRAINT spec_groups_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.characteristic_groups_legacy(id) ON DELETE CASCADE;


--
-- TOC entry 4201 (class 2606 OID 18250)
-- Name: user_audit_log user_audit_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_audit_log
    ADD CONSTRAINT user_audit_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 4200 (class 2606 OID 18235)
-- Name: user_sessions user_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4198 (class 2606 OID 18220)
-- Name: users users_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 4199 (class 2606 OID 18215)
-- Name: users users_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE SET NULL;


--
-- TOC entry 4217 (class 2606 OID 19515)
-- Name: variant_attribute_values variant_attribute_values_attribute_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.variant_attribute_values
    ADD CONSTRAINT variant_attribute_values_attribute_type_id_fkey FOREIGN KEY (attribute_type_id) REFERENCES public.variant_attribute_types(id) ON DELETE CASCADE;


--
-- TOC entry 4224 (class 2606 OID 19750)
-- Name: variant_attributes_new variant_attributes_new_attribute_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.variant_attributes_new
    ADD CONSTRAINT variant_attributes_new_attribute_type_id_fkey FOREIGN KEY (attribute_type_id) REFERENCES public.variant_attribute_types(id);


--
-- TOC entry 4225 (class 2606 OID 19755)
-- Name: variant_attributes_new variant_attributes_new_attribute_value_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.variant_attributes_new
    ADD CONSTRAINT variant_attributes_new_attribute_value_id_fkey FOREIGN KEY (attribute_value_id) REFERENCES public.variant_attribute_values(id);


--
-- TOC entry 4226 (class 2606 OID 19745)
-- Name: variant_attributes_new variant_attributes_new_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.variant_attributes_new
    ADD CONSTRAINT variant_attributes_new_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id) ON DELETE CASCADE;


--
-- TOC entry 4215 (class 2606 OID 19125)
-- Name: variant_characteristics_simple variant_characteristics_simple_value_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.variant_characteristics_simple
    ADD CONSTRAINT variant_characteristics_simple_value_id_fkey FOREIGN KEY (value_id) REFERENCES public.characteristics_values_simple(id) ON DELETE CASCADE;


--
-- TOC entry 4216 (class 2606 OID 19120)
-- Name: variant_characteristics_simple variant_characteristics_simple_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.variant_characteristics_simple
    ADD CONSTRAINT variant_characteristics_simple_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id) ON DELETE CASCADE;


--
-- TOC entry 4218 (class 2606 OID 19540)
-- Name: variant_characteristics variant_characteristics_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.variant_characteristics
    ADD CONSTRAINT variant_characteristics_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.characteristic_templates(id);


--
-- TOC entry 4219 (class 2606 OID 19535)
-- Name: variant_characteristics variant_characteristics_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.variant_characteristics
    ADD CONSTRAINT variant_characteristics_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id) ON DELETE CASCADE;


--
-- TOC entry 4220 (class 2606 OID 19561)
-- Name: variant_images variant_images_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.variant_images
    ADD CONSTRAINT variant_images_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id) ON DELETE CASCADE;


--
-- TOC entry 4221 (class 2606 OID 19581)
-- Name: variant_price_tiers variant_price_tiers_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.variant_price_tiers
    ADD CONSTRAINT variant_price_tiers_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id) ON DELETE CASCADE;


--
-- TOC entry 4196 (class 2606 OID 18089)
-- Name: warehouse_cities warehouse_cities_region_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse_cities
    ADD CONSTRAINT warehouse_cities_region_id_fkey FOREIGN KEY (region_id) REFERENCES public.warehouse_regions(id) ON DELETE CASCADE;


--
-- TOC entry 4190 (class 2606 OID 18135)
-- Name: warehouse_inventory warehouse_inventory_article_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse_inventory
    ADD CONSTRAINT warehouse_inventory_article_id_fkey FOREIGN KEY (article_id) REFERENCES public.warehouse_articles(id) ON DELETE SET NULL;


--
-- TOC entry 4191 (class 2606 OID 18014)
-- Name: warehouse_inventory warehouse_inventory_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse_inventory
    ADD CONSTRAINT warehouse_inventory_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;


--
-- TOC entry 4192 (class 2606 OID 18019)
-- Name: warehouse_inventory warehouse_inventory_section_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse_inventory
    ADD CONSTRAINT warehouse_inventory_section_id_fkey FOREIGN KEY (section_id) REFERENCES public.warehouse_sections(id) ON DELETE SET NULL;


--
-- TOC entry 4193 (class 2606 OID 18040)
-- Name: warehouse_movements warehouse_movements_from_section_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse_movements
    ADD CONSTRAINT warehouse_movements_from_section_id_fkey FOREIGN KEY (from_section_id) REFERENCES public.warehouse_sections(id) ON DELETE SET NULL;


--
-- TOC entry 4194 (class 2606 OID 18035)
-- Name: warehouse_movements warehouse_movements_inventory_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse_movements
    ADD CONSTRAINT warehouse_movements_inventory_id_fkey FOREIGN KEY (inventory_id) REFERENCES public.warehouse_inventory(id) ON DELETE CASCADE;


--
-- TOC entry 4195 (class 2606 OID 18045)
-- Name: warehouse_movements warehouse_movements_to_section_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse_movements
    ADD CONSTRAINT warehouse_movements_to_section_id_fkey FOREIGN KEY (to_section_id) REFERENCES public.warehouse_sections(id) ON DELETE SET NULL;


--
-- TOC entry 4189 (class 2606 OID 17991)
-- Name: warehouse_sections warehouse_sections_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse_sections
    ADD CONSTRAINT warehouse_sections_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.warehouse_zones(id) ON DELETE CASCADE;


--
-- TOC entry 4197 (class 2606 OID 18110)
-- Name: warehouse_warehouses warehouse_warehouses_city_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse_warehouses
    ADD CONSTRAINT warehouse_warehouses_city_id_fkey FOREIGN KEY (city_id) REFERENCES public.warehouse_cities(id) ON DELETE CASCADE;


--
-- TOC entry 4188 (class 2606 OID 18115)
-- Name: warehouse_zones warehouse_zones_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse_zones
    ADD CONSTRAINT warehouse_zones_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouse_warehouses(id) ON DELETE CASCADE;


-- Completed on 2025-07-25 10:46:20 UTC

--
-- PostgreSQL database dump complete
--

