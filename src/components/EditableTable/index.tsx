/* eslint-disable react/no-multi-comp */
import React, { useState, useEffect } from 'react';
import { Table, Spin, Button, Popconfirm, Form, Row, Col } from 'antd';
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
  onChange?: (data: RecordType & { key: number }[]) => void;
  initialValues?: Partial<RecordType>,
  onCreate?: (fieldsValue: RecordType & { key: number }) => Promise<boolean | void>;
  onUpdate?: (fieldsValue: RecordType & { key: number }) => Promise<boolean | void>;
  onDelete?: (record: RecordType & { key: number }) => Promise<boolean | void>;
  onCancel?: (prevRecord: RecordType & { key: number }, record: RecordType & { key: number }) => void;
  loading?: boolean;
  // 添加一条记录时，回调处理新增的记录
  onAdd?: (initialRecord: RecordType, prevData: RecordType[]) => RecordType;
  editingKey?: (editingKey: number | null) => void;
  options?: OptionsType;
  toolBarRender?: () => React.ReactNode[];
  tailAdd?: boolean;
}

function getKeyedData<RecordType>(initialData: RecordType[]) {
  return initialData.map((item, index) => {
    return {
      ...item,
      key: index + 1,
    }
  })
}

export interface EditableTableHandles {
  isEditing: () => boolean;
}

const InternalEditableTable: React.ForwardRefRenderFunction<EditableTableHandles, EditableTableProps> = (props, ref) => {
  const intl = useIntl();
  const {
    columns,
    data = [],
    initialValues = {},
    form,
    loading = false,
    onCreate = () => true,
    onUpdate = () => true,
    onDelete = () => true,
    onChange,
    onAdd,
    options,
    toolBarRender,
    tailAdd = true,
  } = props;

  const [wrapForm] = Form.useForm(form);
  const { create = true } = options || {};

  const [count, setCount] = useState<number>(data?.length || 0);
  const [editingKey, setEditingKey] = useState<number | null>(null);
  const [tableLoading, setTableLoading] = useState<boolean>(false);

  React.useImperativeHandle(ref, () => ({
    isEditing: () => !!editingKey,
  }));

  useEffect(() => {
    // 只在数据初始化时设置 `count` 值
    console.log(count, data, data.length);
    if (count === 0 && Array.isArray(data) && data.length) {
      setCount(data.length);
    }

    // 卸载时重置为 0
    return () => {
      setCount(0);
    }
  }, [data]);

  useEffect(() => {
    if (props.editingKey) {
      props.editingKey(editingKey);
    }
    if (editingKey) {
      wrapForm.setFieldsValue({
        ..._find(getKeyedData(data), { key: editingKey as any }),
      });
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

  const handleAdd = () => {
    let newRecord = { ...initialValues };
    if (onAdd) {
      newRecord = { ...newRecord, ...onAdd(newRecord, getKeyedData(data)) };
    }

    onChange?.(tailAdd ?
      [
        ...getKeyedData(data),
        {
          ...newRecord,
          key: count + 1,
        },
      ] :
      [
        {
          ...newRecord,
          key: count + 1,
        },
        ...getKeyedData(data),
      ]
    );
    setEditingKey(count + 1);
    setCount(count + 1);
  };

  const handleDelete = async (record) => {
    let isOk: boolean | void;
    if (!record.id) {
      isOk = true;
    } else {
      isOk = await handleLoading(async () => await onDelete(record));
    }
    if (isOk !== false) {
      onChange?.(getKeyedData(data).filter(item => item.key !== record.key));
    }
  };

  const isEditingRecord = (record) => record.key === editingKey;

  const handleCancel = (prevRecord) => {
    const { onCancel } = props;
    if (_isFunction(onCancel)) { onCancel(prevRecord, { ...prevRecord, ...getColumnsValue(wrapForm.getFieldsValue()) }) }
    if (!prevRecord.id) {
      onChange?.(getKeyedData(data).filter(item => item.id));
      setEditingKey(null);
      return;
    }
    setEditingKey(null);
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

  const handleSave = (key: number) => {
    wrapForm.validateFields().then(async (fieldsValue) => {
      console.log(fieldsValue);
      const filteredValue = getColumnsValue(fieldsValue);
      const newData = _cloneDeep(getKeyedData(data));
      const targetIndex = _findIndex(newData, item => item.key === key);
      const newRecord = {
        ...newData[targetIndex],
        ...filteredValue,
      };
      const { id } = newRecord;
      let isOk: boolean | void = true;
      if (id !== undefined) {
        isOk = await handleLoading(async () => await onUpdate(newRecord));
      } else {
        isOk = await handleLoading(async () => await onCreate(newRecord));
      }

      if (isOk !== false) {
        newData.splice(targetIndex, 1, newRecord);
        onChange?.(newData);
        setEditingKey(null);
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
        onCell: record => ({
          record,
          formItemConfig: col.editConfig,
          dataIndex: col.dataIndex,
          title: col.title as any,
          editing: isEditingRecord(record),
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

    const setInitOptionsConfig = (record) => {
      let result: { text: string; onClick: (() => void) | undefined }[] = [
        {
          text: intl.getMessage('edit', '编辑'),
          onClick: () => { setEditingKey(record.key) },
        },
        {
          text: intl.getMessage('delete', '删除'),
          onClick: () => { handleDelete(record) },
        },
      ];
      if (editingKey && editingKey !== record.key) {
        return result.map(item => ({ text: item.text, onClick: undefined }));
      }
      return result;
    }

    const setEditOptionsConfig = (record) => {
      return [
        {
          text: intl.getMessage('save', '保存'),
          onClick: () => { handleSave(record.key) },
        },
        {
          text: intl.getMessage('cancel', '取消'),
          onClick: () => { handleCancel(record) },
        },
      ];
    }

    return [
      ...columns.map(setRenderForColumn),
      {
        title: intl.getMessage('option', '操作'),
        render: (_: void, record) => {
          if (editingKey === null || editingKey !== record.key) {
            return addDivider(setInitOptionsConfig(record).map(renderOption));
          }
          return addDivider(setEditOptionsConfig(record).map(renderOption));
        }
      }
    ]
  }

  const components = {
    body: {
      cell: EditableCell,
    },
  };

  const createOption = (
    <Button
      type='primary'
      key='create'
      onClick={handleAdd}
      disabled={!!editingKey}
    >
      {intl.getMessage('create', '新建')}
    </Button>
  )

  const _options: React.ReactNode[] = [create && createOption, toolBarRender ? toolBarRender() : null].filter(item => item);

  return (
    <Spin spinning={loading || tableLoading}>
      <Form form={wrapForm}>
        <Row gutter={8} style={{ margin: "12px 0" }}>
          {_options.map((item, index) => {
            return (
              <Col key={index}>
                {item}
              </Col>
            );
          })}
        </Row>
        <Table
          rowKey='key'
          rowClassName={(_, index) => {
            if (index % 2) {
              return 'table-row';
            }
            return '';
          }}
          components={components}
          bordered
          dataSource={getKeyedData(data)}
          columns={parseColumns(renderColumns())}
          pagination={false}
        />
      </Form>
    </Spin>
  );
}

const EditableTable = React.forwardRef(InternalEditableTable);

export default EditableTable;
