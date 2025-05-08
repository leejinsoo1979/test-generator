import React, { useState, useEffect, useCallback, memo } from 'react';
import ThreeViewer from './ThreeViewer';

// 모듈 카드 컴포넌트 - 메모이제이션으로 성능 최적화
const ModuleCard = memo(({ 
  module, 
  isSelected, 
  onSelect, 
  onAddShelf, 
  onRemoveShelf 
}) => {
  return (
    <div 
      className={`flex-shrink-0 p-3 rounded-lg border-2 ${
        isSelected 
          ? 'border-blue-500 bg-blue-50' 
          : 'border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50'
      } w-60 cursor-pointer transition-all`}
      onClick={() => onSelect(module.id)}
    >
      <div className="flex justify-between items-center mb-2">
        <h4 className="font-bold text-sm">
          {module.position === 'base' ? '하부장' : 
           module.position === 'top' ? '상부장' : 
           module.position === 'right' ? '우측장' : module.id}
        </h4>
        <span className={`px-2 py-0.5 text-xs rounded-full ${
          module.position === 'base' ? 'bg-gray-200 text-gray-700' :
          module.position === 'top' ? 'bg-blue-100 text-blue-700' : 
          'bg-orange-100 text-orange-700'
        }`}>
          {module.id.split('_')[0]}
        </span>
      </div>
      
      {/* 모듈 정보 요약 */}
      <div className="text-xs text-gray-600 mb-3 bg-gray-50 p-2 rounded">
        <div className="grid grid-cols-3 gap-1">
          <div className="flex flex-col items-center">
            <span className="font-semibold">너비</span>
            <span>{module.dimensions.width}</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="font-semibold">높이</span>
            <span>{module.dimensions.height}</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="font-semibold">깊이</span>
            <span>{module.dimensions.depth}</span>
          </div>
        </div>
      </div>
      
      {/* 선반 컨트롤 */}
      <div className="flex items-center justify-between border-t border-gray-200 pt-2">
        <span className="text-sm font-medium">선반 {module.shelves?.count || 0}개</span>
        <div className="flex space-x-1">
          <button
            className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onAddShelf(module.id);
            }}
          >
            추가
          </button>
          <button
            className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm transition-colors disabled:bg-red-300 disabled:cursor-not-allowed"
            onClick={(e) => {
              e.stopPropagation();
              onRemoveShelf(module.id);
            }}
            disabled={!module.shelves?.count}
          >
            제거
          </button>
        </div>
      </div>
    </div>
  );
});

ModuleCard.displayName = 'ModuleCard';

const ThreeViewerWithControls = ({ moduleState, setModuleState }) => {
  const [selectedModuleId, setSelectedModuleId] = useState(null);

  // 모듈 선택 핸들러 - useCallback으로 메모이제이션
  const handleModuleSelect = useCallback((moduleId) => {
    setSelectedModuleId(moduleId);
  }, []);

  // 선반 추가 함수 - useCallback으로 메모이제이션
  const addShelf = useCallback((moduleId) => {
    const newModuleState = { ...moduleState };
    const modules = [...newModuleState.modules];
    
    // 선택한 모듈 찾기
    const moduleIndex = modules.findIndex(m => m.id === moduleId);
    if (moduleIndex === -1) return;
    
    const module = modules[moduleIndex];
    
    // 선반 수 증가
    if (!module.shelves) {
      module.shelves = { count: 0, distribution: 'equal', positions: [] };
    }
    
    module.shelves.count = (module.shelves.count || 0) + 1;
    
    // 모듈 상태 업데이트
    newModuleState.modules = modules;
    setModuleState(newModuleState);
  }, [moduleState, setModuleState]);

  // 선반 제거 함수 - useCallback으로 메모이제이션
  const removeShelf = useCallback((moduleId) => {
    const newModuleState = { ...moduleState };
    const modules = [...newModuleState.modules];
    
    // 선택한 모듈 찾기
    const moduleIndex = modules.findIndex(m => m.id === moduleId);
    if (moduleIndex === -1) return;
    
    const module = modules[moduleIndex];
    
    // 선반이 있는 경우에만 제거
    if (module.shelves && module.shelves.count > 0) {
      module.shelves.count -= 1;
      
      // 모듈 상태 업데이트
      newModuleState.modules = modules;
      setModuleState(newModuleState);
    }
  }, [moduleState, setModuleState]);
  
  // 모듈이 변경될 때 새로운 모듈이 선택되도록 함
  useEffect(() => {
    if (moduleState.modules && moduleState.modules.length > 0) {
      // 선택된 모듈이 없거나 선택된 모듈이 더 이상 존재하지 않는 경우
      if (!selectedModuleId || !moduleState.modules.find(m => m.id === selectedModuleId)) {
        setSelectedModuleId(moduleState.modules[0].id);
      }
    }
  }, [moduleState.modules, selectedModuleId]);
  
  return (
    <div className="flex flex-col">
      {/* 3D 뷰어 컨테이너 */}
      <div className="rounded-t-xl overflow-hidden">
        <ThreeViewer moduleState={moduleState} setModuleState={setModuleState} />
      </div>
      
      {/* 모듈 컨트롤 컨테이너 (하단) */}
      {moduleState.modules && moduleState.modules.length > 0 && (
        <div className="bg-white shadow-lg rounded-b-xl p-4 border-t border-gray-200">
          <h3 className="text-sm font-bold text-gray-600 mb-3 px-2">모듈 컨트롤</h3>
          <div className="flex space-x-3 overflow-x-auto pb-2">
            {moduleState.modules.map(module => (
              <ModuleCard
                key={module.id}
                module={module}
                isSelected={selectedModuleId === module.id}
                onSelect={handleModuleSelect}
                onAddShelf={addShelf}
                onRemoveShelf={removeShelf}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default memo(ThreeViewerWithControls); 