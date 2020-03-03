/* eslint-disable react/no-multi-comp */
import React from 'react';
import { Form } from 'antd';
import { ColumnType } from 'antd/lib/table';
import _get from 'lodash/get';
import _isArray from 'lodash/isArray';
import _find from 'lodash/find';
import _cloneDeep from 'lodash/cloneDeep';
import _findIndex from 'lodash/findIndex';
import { createFormItems, IntlConsumer } from 'antd-form-mate';

import { FormItemConfig } from './index';


export interface EditableColumnProps<T> extends ColumnType<T> {
  formItemConfig?: FormItemConfig;
}

export interface EditableCellProps<T> {
  editing?: boolean;
  record: T;
  formItemConfig: FormItemConfig,
  dataIndex: string,
  title: string,
  children: any;
}

export default function EditableCell<T>(props: EditableCellProps<T>) {
  const renderCell = ({ locale, getMessage }) => {
    const {
      editing,
      dataIndex,
      title,
      formItemConfig = {},
      record,
      children,
      ...restProps
    } = props;

    const { formItemProps = {}, ...restFormItemConfig } = formItemConfig;
    const { required, rules, ...restFormItemProps } = formItemProps;

    function setRules() {
      let result = rules ? [...rules] : [];

      if (required && !_find(rules, { required: true })) {
        result = [
          {
            required: true,
            message: `${title} ${getMessage('message.isRequired', '必填')}`,
          },
          ...result,
        ]
      }

      return result;
    }

    return (
      <td {...restProps}>
        {editing && dataIndex ? (
          <Form.Item style={{ margin: 0 }}>
            {createFormItems([
              {
                ...restFormItemConfig,
                name: dataIndex,
                formItemProps: {
                  dense: true,
                  rules: setRules(),
                  ...restFormItemProps,
                },
              },
            ])}
          </Form.Item>
        ) : (
            children
          )}
      </td>
    );
  };
  return (
    <IntlConsumer>
      {renderCell}
    </IntlConsumer>
  );
}
