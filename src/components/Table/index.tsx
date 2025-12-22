import React, { useState, useMemo } from 'react';
import './index.css';

interface TableProps {
  columns: any[];
  data: any[];
  defaultPageSize?: number;
  defaultSortBy?: string | null;
  showPagination?: boolean;
  striped?: boolean;
  hover?: boolean;
  bordered?: boolean;
  responsive?: boolean;
  className?: string;
  onRowClick?: ((row: any) => void) | null;
}

const Table: React.FC<TableProps> = ({
  columns,
  data,
  defaultPageSize = 10,
  defaultSortBy = null,
  showPagination = true,
  striped = false,
  hover = true,
  bordered = false,
  responsive = true,
  className = '',
  onRowClick = null
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [sortBy, setSortBy] = useState<string | null>(defaultSortBy);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [filters, setFilters] = useState<Record<string, any>>({});

  // 处理排序
  const handleSort = (columnKey: string) => {
    if (sortBy === columnKey) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(columnKey);
      setSortDirection('asc');
    }
  };

  // 处理筛选
  const handleFilter = (columnKey: string, value: any) => {
    setFilters(prev => ({
      ...prev,
      [columnKey]: value
    }));
    setCurrentPage(1); // 重置到第一页
  };

  // 处理分页变化
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // 处理每页显示数量变化
  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  // 处理行点击
  const handleRowClick = (row: any) => {
    if (onRowClick) {
      onRowClick(row);
    }
  };

  // 处理数据筛选、排序和分页
  const processedData = useMemo(() => {
    let filteredData = data.filter(row => 
      columns.every(column => {
        if (!filters[column.key]) return true;
        const cellValue = row[column.key];
        return String(cellValue).toLowerCase().includes(String(filters[column.key]).toLowerCase());
      })
    );

    if (sortBy) {
      filteredData.sort((a, b) => {
        const aValue = a[sortBy];
        const bValue = b[sortBy];
        
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortDirection === 'asc' 
            ? aValue.localeCompare(bValue) 
            : bValue.localeCompare(aValue);
        }
        
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      });
    }

    return filteredData;
  }, [data, columns, filters, sortBy, sortDirection]);

  // 计算分页后的数据
  const paginatedData = useMemo(() => {
    if (!showPagination) return processedData;
    
    const startIndex = (currentPage - 1) * pageSize;
    return processedData.slice(startIndex, startIndex + pageSize);
  }, [processedData, currentPage, pageSize, showPagination]);

  // 计算总页数
  const totalPages = Math.ceil(processedData.length / pageSize);

  return (
    <div className={`table-container ${responsive ? 'table-responsive' : ''} ${className}`}>
      <table className={`custom-table ${bordered ? 'table-bordered' : ''} ${striped ? 'table-striped' : ''} ${hover ? 'table-hover' : ''}`}>
        <thead>
          <tr>
            {columns.map(column => (
              <th 
                key={column.key} 
                style={{ width: column.width }}
                className={column.sortable ? 'sortable' : ''}
                onClick={() => column.sortable && handleSort(column.key)}
              >
                <div className="header-content">
                  {column.title}
                  {column.sortable && (
                    <span className="sort-indicator">
                      {sortBy === column.key && (
                        sortDirection === 'asc' ? ' ↑' : ' ↓'
                      )}
                    </span>
                  )}
                </div>
                {column.filterable && (
                  <div className="filter-container">
                    <input
                      type="text"
                      value={filters[column.key] || ''}
                      onChange={(e) => handleFilter(column.key, e.target.value)}
                      placeholder={`筛选 ${column.title}`}
                      className="filter-input"
                    />
                  </div>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {paginatedData.length > 0 ? (
            paginatedData.map((row, index) => (
              <tr 
                key={index} 
                onClick={() => handleRowClick(row)}
                className={onRowClick ? 'clickable' : ''}
              >
                {columns.map(column => (
                  <td key={column.key}>
                    {column.render ? column.render(row[column.key], row) : row[column.key]}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={columns.length} className="no-data">
                暂无数据
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {showPagination && processedData.length > 0 && (
        <div className="pagination-container">
          <div className="pagination-info">
            显示 {Math.min((currentPage - 1) * pageSize + 1, processedData.length)} 到{' '}
            {Math.min(currentPage * pageSize, processedData.length)} 条，共 {processedData.length} 条
          </div>
          <div className="pagination-controls">
            <select 
              value={pageSize} 
              onChange={(e) => handlePageSizeChange(Number(e.target.value))}
              className="page-size-select"
            >
              <option value={5}>5 条/页</option>
              <option value={10}>10 条/页</option>
              <option value={20}>20 条/页</option>
              <option value={50}>50 条/页</option>
            </select>
            
            <button 
              onClick={() => handlePageChange(1)} 
              disabled={currentPage === 1}
              className="pagination-btn"
            >
              首页
            </button>
            <button 
              onClick={() => handlePageChange(currentPage - 1)} 
              disabled={currentPage === 1}
              className="pagination-btn"
            >
              上一页
            </button>
            
            <span className="pagination-page">
              第 {currentPage} 页 / 共 {totalPages} 页
            </span>
            
            <button 
              onClick={() => handlePageChange(currentPage + 1)} 
              disabled={currentPage === totalPages}
              className="pagination-btn"
            >
              下一页
            </button>
            <button 
              onClick={() => handlePageChange(totalPages)} 
              disabled={currentPage === totalPages}
              className="pagination-btn"
            >
              末页
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Table;
