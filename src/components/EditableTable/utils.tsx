import React from 'react';
import { Divider } from 'antd';
import _get from 'lodash/get';
import _isArray from 'lodash/isArray';
import _flatten from "lodash/flatten";

import { EditableColumnProps } from "./index";

export function setRenderForColumn(column: EditableColumnProps<any>) {
  if (column.render !== undefined) return column;
  const options = _get(column, 'formItemConfig.componentProps.options');
  if (_isArray(options) && options.length) {
    column.render = (value) => {
      const target = options.find(item => item.value === value);
      if (target) {
        return target.text;
      }
      return '-';
    }
  }
  return column;
}

export function addDivider(actions: React.ReactNode[]) {
  return _flatten(
    actions.map((item, index) => {
      if (index + 1 < actions.length) {
        return [item, <Divider key={`${index}_divider`} type="vertical" />];
      }
      return [item];
    })
  );
}
