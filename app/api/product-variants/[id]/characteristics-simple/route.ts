import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

// GET /api/product-variants/[id]/characteristics-simple - получить характеристики варианта
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const variantId = params.id;

    // Проверяем, что вариант существует
    const variantCheck = await pool.query(
      'SELECT id, master_id FROM product_variants WHERE id = $1 AND is_deleted = FALSE',
      [variantId]
    );

    if (variantCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Вариант товара не найден' },
        { status: 404 }
      );
    }

    const productId = variantCheck.rows[0].master_id;

    // Получаем характеристики варианта из упрощенной системы
    const result = await pool.query(`
      SELECT
        g.id as group_id,
        g.name as group_name,
        g.sort_order as group_sort_order,
        v.id as value_id,
        v.value as value_name,
        v.color_hex,
        v.sort_order as value_sort_order,
        vc.additional_value,
        vc.created_at,
        vc.updated_at
      FROM variant_characteristics_simple vc
      JOIN characteristics_values_simple v ON vc.value_id = v.id
      JOIN characteristics_groups_simple g ON v.group_id = g.id
      WHERE vc.variant_id = $1
      ORDER BY g.sort_order, v.sort_order
    `, [variantId]);

    // Группируем характеристики по группам
    const characteristicsByGroup = result.rows.reduce((acc: any[], char: any) => {
      let group = acc.find(g => g.group_id === char.group_id);
      if (!group) {
        group = {
          group_id: char.group_id,
          group_name: char.group_name,
          characteristics: []
        };
        acc.push(group);
      }

      group.characteristics.push({
        value_id: char.value_id,
        value_name: char.value_name,
        group_id: char.group_id,
        group_name: char.group_name,
        additional_value: char.additional_value || '',
        color_hex: char.color_hex
      });

      return acc;
    }, []);

    // Также возвращаем плоский массив для совместимости
    const flatCharacteristics = result.rows.map(char => ({
      value_id: char.value_id,
      value_name: char.value_name,
      group_id: char.group_id,
      group_name: char.group_name,
      additional_value: char.additional_value || '',
      color_hex: char.color_hex
    }));

    return NextResponse.json({
      success: true,
      data: {
        variant_id: parseInt(variantId),
        product_id: productId,
        characteristics: flatCharacteristics,
        characteristics_by_group: characteristicsByGroup
      }
    });

  } catch (error) {
    console.error('Ошибка получения характеристик варианта:', error);
    return NextResponse.json(
      { error: 'Ошибка получения характеристик варианта' },
      { status: 500 }
    );
  }
}

// POST /api/product-variants/[id]/characteristics-simple - сохранить характеристики варианта
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const variantId = params.id;
    const body = await request.json();
    const { characteristics } = body;

    if (!Array.isArray(characteristics)) {
      return NextResponse.json(
        { error: 'Ожидается массив характеристик' },
        { status: 400 }
      );
    }

    // Проверяем, что вариант существует
    const variantCheck = await pool.query(
      'SELECT id FROM product_variants WHERE id = $1 AND is_deleted = FALSE',
      [variantId]
    );

    if (variantCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Вариант товара не найден' },
        { status: 404 }
      );
    }

    await pool.query('BEGIN');

    try {
      // Сначала удаляем все существующие характеристики варианта
      await pool.query(`
        DELETE FROM variant_characteristics_simple
        WHERE variant_id = $1
      `, [variantId]);

      const savedCharacteristics = [];

      // Добавляем новые характеристики
      for (const char of characteristics) {
        const { value_id, additional_value } = char;

        if (!value_id) {
          console.warn('Пропускаем характеристику без value_id:', char);
          continue;
        }

        // Проверяем существование value_id
        const valueCheck = await pool.query(
          'SELECT id FROM characteristics_values_simple WHERE id = $1',
          [value_id]
        );

        if (valueCheck.rows.length === 0) {
          console.warn(`Пропускаем несуществующий value_id: ${value_id}`);
          continue;
        }

        // Вставляем характеристику
        const result = await pool.query(`
          INSERT INTO variant_characteristics_simple (variant_id, value_id, additional_value)
          VALUES ($1, $2, $3)
          RETURNING *
        `, [variantId, value_id, additional_value || null]);

        savedCharacteristics.push(result.rows[0]);
      }

      await pool.query('COMMIT');

      return NextResponse.json({
        success: true,
        data: {
          variant_id: parseInt(variantId),
          saved_characteristics: savedCharacteristics,
          total_saved: savedCharacteristics.length
        }
      });

    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('Ошибка сохранения характеристик варианта:', error);
    return NextResponse.json(
      { error: 'Ошибка сохранения характеристик варианта' },
      { status: 500 }
    );
  }
}

// DELETE /api/product-variants/[id]/characteristics-simple - удалить характеристики варианта
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const variantId = params.id;

    // Удаляем все характеристики варианта
    const result = await pool.query(`
      DELETE FROM variant_characteristics_simple
      WHERE variant_id = $1
      RETURNING *
    `, [variantId]);

    return NextResponse.json({
      success: true,
      data: {
        variant_id: parseInt(variantId),
        deleted_count: result.rows.length
      }
    });

  } catch (error) {
    console.error('Ошибка удаления характеристик варианта:', error);
    return NextResponse.json(
      { error: 'Ошибка удаления характеристик варианта' },
      { status: 500 }
    );
  }
}