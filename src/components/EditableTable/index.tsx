/* eslint-disable react/no-multi-comp */
import React, { useState, useEffect } from 'react';
import { Table, Spin, Popconfirm, Form } from 'antd';
import { FormInstance } from 'antd/lib/form/Form';
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

export interface OptionsType {
  create?: boolean;
}

export interface EditableTableProps<RecordType = any> extends Omit<TableProps<RecordType>, "dataSource" | "onChange"> {
  form?: FormInstance;
  columns?: EditableColumnProps<RecordType>[];
  data?: RecordType[];
  onChange?: (data: RecordType[]) => void;
  onCreate?: (fieldsValue: RecordType) => Promise<boolean | void>;
  onUpdate?: (fieldsValue: RecordType) => Promise<boolean | void>;
  onDelete?: (record: RecordType) => Promise<boolean | void>;
  onCancel?: (prevRecord: RecordType, record: RecordType) => void;
  loading?: boolean;
  // 添加一条记录时，回调处理新增的记录
  onAdd?: (initialRecord: RecordType, prevData: RecordType[]) => RecordType;
  editingKey?: string | null;
  setEditingKey?: (key: string | null) => void;
  isExistedRow?: (record: RecordType) => boolean;
}

function getKey<RecordType>(record: RecordType, index: number, rowKey: EditableTableProps<RecordType>["rowKey"]) {
  if (_isFunction(rowKey)) {
    return `${rowKey(record, index)}`;
  }
  return `${record[rowKey!]}`;
}

export default function EditableTable<RecordType>(props: EditableTableProps<RecordType>) {
  const intl = useIntl();
  const {
    columns,
    data = [],
    form,
    loading = false,
    onCreate = () => true,
    onUpdate = () => true,
    onDelete = () => true,
    onChange,
    onAdd,
    editingKey,
    setEditingKey,
    isExistedRow = () => true,
    ...rest
  } = props;

  const [wrapForm] = Form.useForm(form);

  const [tableLoading, setTableLoading] = useState<boolean>(false);

  const getFilteredData = (record: RecordType, index: number) => {
    return data.filter((item, itemIndex) => {
      const itemKey = getKey(item, itemIndex, rest.rowKey);
      return itemKey !== getKey(record, index, rest.rowKey);
    });
  }

  useEffect(() => {
    if (editingKey) {
      data.forEach((item, index) => {
        const itemKey = getKey(item, index, rest.rowKey);
        if (itemKey) {
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
    if (!isExistedRow(record)) {
      isOk = true;
    } else {
      isOk = await handleLoading(async () => await onDelete(record));
    }
    if (isOk !== false) {
      onChange?.(getFilteredData(record, index));
    }
  };

  const isEditingRecord = (record, index) => editingKey && getKey(record, index, rest.rowKey) === editingKey;

  const handleCancel = (prevRecord, index) => {
    const { onCancel } = props;
    if (_isFunction(onCancel)) { onCancel(prevRecord, { ...prevRecord, ...getColumnsValue(wrapForm.getFieldsValue()) }) }
    console.log(!isExistedRow?.(prevRecord));
    if (!isExistedRow?.(prevRecord)) {
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
        const itemKey = getKey(item, itemIndex, rest.rowKey);
        return itemKey === getKey(record, index, rest.rowKey);
      });
      const newRecord = {
        ...newData[targetIndex],
        ...filteredValue,
      };
      let isOk: boolean | void = true;
      if (isExistedRow(newRecord)) {
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
          onClick: () => { setEditingKey?.(getKey(record, index, rest.rowKey)) },
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
          if (!editingKey || editingKey !== getKey(record, index, rest.rowKey)) {
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

  return (
    <Spin spinning={loading || tableLoading}>
      <Form form={wrapForm}>
        <Table
          bordered
          pagination={false}
          {...rest}
          components={components}
          dataSource={data}
          columns={parseColumns(renderColumns())}
        />
      </Form>
    </Spin>
  );
}
