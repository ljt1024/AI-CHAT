export const debounce = (
  func,
  delay,
  immediate = true
) => {
  let timeoutId = null;

  return (...args) => {
    const later = () => {
      timeoutId = null;
      if (!immediate) func(...args);
    };

    const shouldCallNow = immediate && !timeoutId;

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(later, delay);

    if (shouldCallNow) {
      func(...args);
    }
  };
};


// 导出json
export function exportJson(data, filename) {
  return new Promise((resolve, reject) => {
    try {
      // 将数据转换为JSON字符串
      const jsonString = JSON.stringify(data, null, 2); // 使用2个空格进行缩进，使输出更易读
      // 创建Blob对象
      const blob = new Blob([jsonString], { type: 'application/json' });
      // 创建URL
      const url = URL.createObjectURL(blob);
      // 创建a标签
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || 'data.json';
      // 模拟点击下载
      document.body.appendChild(a);
      a.click();
      // 清理URL对象和移除a标签
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        resolve()
      }, 0);
    } catch (error) {
      reject(error)
    }
  })
}

// 合并两个数组, 数组中有相同的id, b数组覆盖a数组中相同id的项
export function mergeArrays(a, b) {
  if (!Array.isArray(b)) {
    throw new Error('非法的导入格式')
  }
  const result = [...a]

  const idIndexMap = new Map()
  result.forEach((item, index) => {
    idIndexMap.set(item.id, index)
  })

  b.forEach(item=> {
    const id = item.id
    if (idIndexMap.has(id)) {
      const index = idIndexMap.get(id)
      result[index] = { ...result[index], ...item}
    } else {
      result.push(item)
    }
  })

  return result
}

