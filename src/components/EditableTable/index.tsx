/* eslint-disable react/no-multi-comp */
import React, { useState, useEffect } from 'react';
import { Table, Spin, Popconfirm, Form } from 'antd';
import { FormProps } from 'antd/lib/form/Form';
import { TableProps, ColumnType } from 'antd/lib/table';
import _get from 'lodash/get';
import _cloneDeep from 'lodash/cloneDeep';
import _find from 'lodash/find';
import _findIndex from 'lodash/findIndex';
import _isFunction from 'lodash/isFunction';
import _isEqual from 'lodash/isEqual';
import { ItemConfig, ComponentType } from 'antd-form-mate/dist/lib/props';

import { setRenderForColumn, addDivider } from './utils';
import styles from './index.less';
import EditableCell from './EditableCell';
import { useIntl } from '../../intl-context';

type Diff<T, U> = T extends U ? never : T;  // Remove types from T that are assignable to U
export type FormItemConfig = Pick<ItemConfig, "componentProps" | "formItemProps" | "component"> & { type?: Diff<ComponentType, 'dynamic'> }

export interface DefaultRecordParams { id: number | string }

export interface EditableColumnProps<RecordType = any> extends ColumnType<RecordType> {
  editConfig?: FormItemConfig;
}

export interface EditableTableProps<RecordType = any> extends Omit<TableProps<RecordType>, "dataSource" | "onChange"> {
  formProps?: FormProps;
  columns?: EditableColumnProps<RecordType>[];
  data?: RecordType[];
  /**
   * 覆盖默认的 `onChange` 事件
   */
  onChange?: (data: RecordType[]) => void;
  /**
   * 创建一条记录的回调，返回值为真时创建成功
   * 
   * 成功后自动回调 `onChange` 和 `setEditingKey` 事件
   */
  onCreate?: (fieldsValue: RecordType) => Promise<boolean | void>;
  /**
   * 更新一条记录的回调，返回值为真时更新成功
   * 
   * 成功后自动回调 `onChange` 和 `setEditingKey` 事件
   */
  onUpdate?: (fieldsValue: RecordType) => Promise<boolean | void>;
  /**
   * 删除一条记录的回调，返回值为真时删除成功
   * 
   * 成功后自动回调 `onChange` 和 `setEditingKey` 事件
   */
  onDelete?: (record: RecordType) => Promise<boolean | void>;
  /**
   * 点击取消时的回调
   * 
   * 可能的使用场景：
   *     存在外部的表单字段与当前的 `data` 联动，比如外部某个字段对 `data` 的某列求和，取消时需要回滚求和结果
   */
  onCancel?: (prevRecord: RecordType, record: RecordType) => void;
  loading?: boolean;
  editingKey?: string | null;
  setEditingKey?: (key: string | null) => void;
  /**
   * 是否已经存在的记录
   * 
   * 1. 当取消或删除时，如果不是已经存在的记录，直接删除，不会还原当前记录或调用 `onDelete` 事件
   * 2. 当保存时，根据是否已经存在判断调用 `onCreate` 还是 `onUpdate`
   */
  isExistedRecord?: (record: RecordType) => boolean;
  withSpin?: boolean;
}

function getRecordKey<RecordType>(rowKey: EditableTableProps<RecordType>["rowKey"]) {
  return (record: RecordType, index: number) => {
    if (_isFunction(rowKey)) {
      return `${rowKey(record, index)}`;
    }
    return `${record[rowKey!]}`;
  }
}

/**
 * 📦 基于 antd-form-mate 的可编辑表格
 * 
 * 组件只对 Table 组件进行了封装，如果需要创建功能，外部渲染一个创建按钮修改相关状态并传入 `onCreate` 事件即可
 */
export default function EditableTable<RecordType>(props: EditableTableProps<RecordType>) {
  const intl = useIntl();
  const {
    formProps,
    columns,
    data = [],
    loading = false,
    onCreate = () => true,
    onUpdate = () => true,
    onDelete = () => true,
    onCancel,
    onChange,
    editingKey,
    setEditingKey,
    isExistedRecord = () => true,
    withSpin = true,
    ...rest
  } = props;

  const [wrapForm] = Form.useForm(formProps?.form);

  const [tableLoading, setTableLoading] = useState<boolean>(false);
  const getKey = getRecordKey(rest.rowKey);

  const getFilteredData = (record: RecordType, index: number) => {
    return data.filter((item, itemIndex) => {
      const itemKey = getKey(item, itemIndex);
      return itemKey !== getKey(record, index);
    });
  }

  useEffect(() => {
    if (editingKey) {
      data.forEach((item, index) => {
        const itemKey = getKey(item, index);
        if (itemKey === editingKey) {
          wrapForm.setFieldsValue(item);
        }
      })
    } else {
      wrapForm.resetFields();
    }
  }, [editingKey]);

  const handleLoading = async (func: () => Promise<boolean | void>) => {
    setTableLoading(true);
    const result = await func();
    setTableLoading(false);
    return result;
  }

  const handleDelete = async (record, index) => {
    let isOk: boolean | void;
    if (!isExistedRecord(record)) {
      isOk = true;
    } else {
      isOk = await handleLoading(async () => await onDelete(record));
    }
    if (isOk !== false) {
      onChange?.(getFilteredData(record, index));
      setEditingKey?.(null);
    }
  };

  const isEditingRecord = (record, index) => editingKey && getKey(record, index) === editingKey;

  const handleCancel = (prevRecord, index) => {
    onCancel?.(prevRecord, { ...prevRecord, ...getColumnsValue(wrapForm.getFieldsValue()) });

    console.log(!isExistedRecord?.(prevRecord));
    if (!isExistedRecord?.(prevRecord)) {
      onChange?.(getFilteredData(prevRecord, index));
      setEditingKey?.(null);
      return;
    }
    setEditingKey?.(null);
  };

  const getColumnsValue = (fieldsValue) => {
    let result: any = {};
    columns && columns.forEach((element) => {
      if (element.dataIndex) {
        result[element.dataIndex as string] = fieldsValue[element.dataIndex as string];
      }
    });
    return result;
  }

  const handleSave = (record: RecordType, index: number) => {
    wrapForm.validateFields().then(async (fieldsValue) => {
      console.log(fieldsValue);
      const filteredValue = getColumnsValue(fieldsValue);
      const newData = _cloneDeep(data);
      const targetIndex = _findIndex(newData, (item, itemIndex) => {
        const itemKey = getKey(item, itemIndex);
        return itemKey === getKey(record, index);
      });
      const newRecord = {
        ...newData[targetIndex],
        ...filteredValue,
      };
      let isOk: boolean | void = true;
      if (isExistedRecord(newRecord)) {
        isOk = await handleLoading(async () => await onUpdate(newRecord));
      } else {
        isOk = await handleLoading(async () => await onCreate(newRecord));
      }

      if (isOk !== false) {
        newData.splice(targetIndex, 1, newRecord);
        onChange?.(newData);
        setEditingKey?.(null);
      }
    });
  }

  const parseColumns: (columns?: EditableColumnProps[]) => (ColumnType<any>[] | undefined) = (columns) => {
    if (!columns) return columns;

    return columns.map(col => {
      if (!col.editConfig) {
        return col;
      }
      return {
        ...col,
        onCell: (record, index) => ({
          record,
          formItemConfig: col.editConfig,
          dataIndex: col.dataIndex,
          title: col.title as any,
          editing: isEditingRecord(record, index),
        }),
      };
    });
  }

  const renderColumns = () => {
    if (!columns) return columns;

    const renderOption = ({ text, onClick }: { text: string, onClick: any }) => {
      if (!onClick) {
        return <span key={text} className={styles.notAllow}>{text}</span>
      }
      if (text === intl.getMessage('delete', '删除')) {
        return (
          <Popconfirm
            key={text}
            title={intl.getMessage('deleteHint', '确定删除吗？')}
            onConfirm={onClick}
          >
            <a>{intl.getMessage('delete', '删除')}</a>
          </Popconfirm>
        )
      }
      return (
        <a key={text} onClick={onClick}>{text}</a>
      )
    }

    const setInitOptionsConfig = (record, index) => {
      let result: { text: string; onClick: (() => void) | undefined }[] = [
        {
          text: intl.getMessage('edit', '编辑'),
          onClick: () => { setEditingKey?.(getKey(record, index)) },
        },
        {
          text: intl.getMessage('delete', '删除'),
          onClick: () => { handleDelete(record, index) },
        },
      ];
      if (editingKey && editingKey !== record.key) {
        return result.map(item => ({ text: item.text, onClick: undefined }));
      }
      return result;
    }

    const setEditOptionsConfig = (record, index) => {
      return [
        {
          text: intl.getMessage('save', '保存'),
          onClick: () => { handleSave(record, index) },
        },
        {
          text: intl.getMessage('cancel', '取消'),
          onClick: () => { handleCancel(record, index) },
        },
      ];
    }

    return [
      ...columns.map(setRenderForColumn),
      {
        title: intl.getMessage('option', '操作'),
        render: (_: void, record, index) => {
          if (!editingKey || editingKey !== getKey(record, index)) {
            return addDivider(setInitOptionsConfig(record, index).map(renderOption));
          }
          return addDivider(setEditOptionsConfig(record, index).map(renderOption));
        }
      }
    ]
  }

  const components = {
    body: {
      cell: EditableCell,
    },
  };

  const FormTable = (
    <Form {...formProps}>
      <Table
        bordered
        pagination={false}
        {...rest}
        components={components}
        dataSource={data}
        columns={parseColumns(renderColumns())}
      />
    </Form>
  );

  return withSpin ? (
    <Spin spinning={loading || tableLoading}>
      {FormTable}
    </Spin>
  ) : FormTable;
}
