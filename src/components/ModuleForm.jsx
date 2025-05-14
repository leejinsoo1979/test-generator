import React, { useState } from 'react'
import ModulePositionModal from './ModulePositionModal'

const panelOptions = [
  { value: 'melamine_white', label: '화이트 멜라민' },
  { value: 'melamine_oak', label: '오크 멜라민' },
  { value: 'mdf_painted', label: '도장 MDF' }
]

const ModuleForm = ({ moduleState, updateModuleState, resetModule, addModule, updateModule }) => {
  const [showPositionModal, setShowPositionModal] = useState(false)
  const [isIntegrated, setIsIntegrated] = useState(false)
  const [unifiedDimensions, setUnifiedDimensions] = useState({
    width: 600,
    height: 700,
    depth: 550
  })
  
  // 입력값 변경 핸들러 (특정 모듈의 특정 섹션 업데이트)
  const handleModuleChange = (e, moduleId, section, field) => {
    const { value, type, checked } = e.target
    const processedValue = type === 'number' ? parseFloat(value) : (type === 'checkbox' ? checked : value)
    
    // 모듈 찾기
    const moduleToUpdate = moduleState.modules.find(m => m.id === moduleId);
    
    if (!moduleToUpdate) {
      console.error(`모듈 ID ${moduleId}을 찾을 수 없습니다.`);
      return;
    }
    
    // 패널 토글 시 특별 처리 (디버깅용)
    if (section === 'panels') {
      console.log(`패널 변경: ${moduleId} ${field} = ${processedValue ? '보임' : '숨김'}`);
    }
    
    // 업데이트할 새 모듈 객체 생성 (불변성 유지)
    let updatedModule;
    
    if (section) {
      // 섹션이 있는 경우 (dimensions, panels, shelves 등)
      const updatedSection = {
        ...moduleToUpdate[section],
        [field]: processedValue
      };
      
      updatedModule = {
        ...moduleToUpdate,
        [section]: updatedSection
      };
      
      if (section === 'panels') {
        // 패널 변경 시 로그
        console.log('패널 상태 업데이트:', updatedSection);
      }
    } else {
      // 직접 필드 업데이트 (type, material 등)
      updatedModule = {
        ...moduleToUpdate,
        [field]: processedValue
      };
    }
    
    // 모든 모듈의 배열 업데이트
    const updatedModules = moduleState.modules.map(module => 
      module.id === moduleId ? updatedModule : module
    );
    
    // 전체 상태 업데이트 (모든 모듈 한번에 교체)
    const newModuleState = {
      ...moduleState,
      modules: updatedModules
    };
    
    // 최상위 상태 업데이트 함수 호출 (리렌더링 발생)
    updateModuleState(newModuleState);
    
    // 패널 토글이 즉시 반영되도록 약간의 지연을 두고 한번 더 업데이트
    if (section === 'panels') {
      setTimeout(() => {
        updateModuleState({...newModuleState});
      }, 100);
    }

    // 통합 모드에서 크기 변경 시 통합 크기 업데이트
    if (isIntegrated && section === 'dimensions') {
      setUnifiedDimensions(prev => ({
        ...prev,
        [field]: processedValue
      }));
    }
  }
  
  // 통합 슬라이더 변경 핸들러
  const handleUnifiedDimensionChange = (e, dimension) => {
    const value = parseFloat(e.target.value);
    
    // 통합 치수 상태 업데이트
    setUnifiedDimensions(prev => ({
      ...prev,
      [dimension]: value
    }));
    
    // 모듈 분류
    const lowerModules = moduleState.modules.filter(m => m.type === 'lower' && m.position !== 'right');
    const rightModules = moduleState.modules.filter(m => m.position === 'right');
    const upperModules = moduleState.modules.filter(m => m.type === 'upper' || m.position === 'top');
    
    const hasLowerModule = lowerModules.length > 0;
    const hasUpperModule = upperModules.length > 0;
    const hasRightModule = rightModules.length > 0;
    
    // 기본 하부장 찾기 (위치 계산의 기준)
    const baseModule = lowerModules[0] || moduleState.modules[0];
    
    // 업데이트할 모듈 배열 생성
    let updatedModules = [...moduleState.modules];
    
    if (dimension === 'width') {
      // 너비 변경 - 전체 가구 너비를 조정
      
      if (hasRightModule && hasLowerModule) {
        // 하부장과 우측장이 있는 경우
        
        // 하부장 너비 계산 (전체 너비의 60%)
        const lowerWidth = Math.round(value * 0.6);
        
        // 우측장 너비 계산 (전체 너비의 40%)
        const rightWidth = value - lowerWidth;
        
        // 하부장 너비 업데이트
        updatedModules = updatedModules.map(module => {
          if (module.type === 'lower' && module.position !== 'right') {
            return {
              ...module,
              dimensions: {
                ...module.dimensions,
                width: lowerWidth
              },
              panelThickness: 18
            };
          }
          else if (module.position === 'right') {
            return {
              ...module,
              dimensions: {
                ...module.dimensions,
                width: rightWidth
              },
              panelThickness: 18
            };
          }
          else if (module.position === 'top' || module.type === 'upper') {
            // 상부장은 전체 너비로 설정
            return {
              ...module,
              dimensions: {
                ...module.dimensions,
                width: value
              },
              panelThickness: 18,
              fixedWidth: true
            };
          }
          return {
            ...module,
            panelThickness: 18
          };
        });
      } 
      else {
        // 하부장만 있거나 상부장만 있는 경우 - 모든 모듈 너비를 동일하게 설정
        updatedModules = updatedModules.map(module => {
          return {
            ...module,
            dimensions: {
              ...module.dimensions,
              width: value
            },
            panelThickness: 18
          };
        });
      }
    } 
    else if (dimension === 'height') {
      // 높이 변경 - 전체 가구 높이를 조정
      
      if (hasUpperModule && hasLowerModule) {
        // 하부장과 상부장이 있는 경우 - 높이를 적절히 분배
        
        // 하부장 높이 계산 (전체 높이의 60%)
        const lowerHeight = Math.round(value * 0.6);
        
        // 상부장 높이 계산 (전체 높이의 40%)
        const upperHeight = value - lowerHeight;
        
        updatedModules = updatedModules.map(module => {
          if (module.type === 'lower' && module.position !== 'right') {
            return {
              ...module,
              dimensions: {
                ...module.dimensions,
                height: lowerHeight
              },
              panelThickness: 18
            };
          }
          else if (module.position === 'right') {
            // 우측장은 하부장과 동일한 높이로 설정
            return {
              ...module,
              dimensions: {
                ...module.dimensions,
                height: lowerHeight
              },
              panelThickness: 18
            };
          }
          else if (module.position === 'top' || module.type === 'upper') {
            return {
              ...module,
              dimensions: {
                ...module.dimensions,
                height: upperHeight
              },
              panelThickness: 18
            };
          }
          return {
            ...module,
            panelThickness: 18
          };
        });
      } 
      else {
        // 단일 모듈만 있는 경우 - 직접 높이 설정
        updatedModules = updatedModules.map(module => {
          return {
            ...module,
            dimensions: {
              ...module.dimensions,
              height: value
            },
            panelThickness: 18
          };
        });
      }
    } 
    else if (dimension === 'depth') {
      // 깊이 변경 - 모든 모듈의 깊이를 동일하게 설정
      updatedModules = updatedModules.map(module => {
        return {
          ...module,
          dimensions: {
            ...module.dimensions,
            depth: value
          },
          panelThickness: 18
        };
      });
    }
    
    // 모듈 상태 업데이트
    updateModuleState({
      ...moduleState,
      modules: updatedModules
    });
  };
  
  // 통합 모드 토글 함수
  const toggleIntegration = () => {
    // 통합 모드 활성화 시 초기 통합 치수 설정
    if (!isIntegrated && moduleState.modules.length > 0) {
      // 모듈 분류
      const lowerModules = moduleState.modules.filter(m => m.type === 'lower' && m.position !== 'right');
      const rightModules = moduleState.modules.filter(m => m.position === 'right');
      const upperModules = moduleState.modules.filter(m => m.type === 'upper' || m.position === 'top');
      
      // 가구 전체 너비 계산
      let totalWidth = 0;
      if (lowerModules.length > 0 && rightModules.length > 0) {
        // 하부장 + 우측장의 너비 합
        totalWidth = lowerModules.reduce((sum, m) => sum + m.dimensions.width, 0) +
                    rightModules.reduce((sum, m) => sum + m.dimensions.width, 0);
      } else if (lowerModules.length > 0) {
        // 하부장만 있는 경우
        totalWidth = lowerModules.reduce((sum, m) => sum + m.dimensions.width, 0);
      } else if (upperModules.length > 0) {
        // 상부장만 있는 경우
        totalWidth = upperModules.reduce((sum, m) => sum + m.dimensions.width, 0);
      } else if (rightModules.length > 0) {
        // 우측장만 있는 경우
        totalWidth = rightModules.reduce((sum, m) => sum + m.dimensions.width, 0);
      } else {
        // 기본값
        totalWidth = 600;
      }
      
      // 가구 전체 높이 계산
      let totalHeight = 0;
      if (lowerModules.length > 0 && upperModules.length > 0) {
        // 하부장 + 상부장의 높이 합
        totalHeight = lowerModules[0].dimensions.height + 
                      upperModules.reduce((sum, m) => sum + m.dimensions.height, 0);
      } else if (lowerModules.length > 0) {
        // 하부장만 있는 경우
        totalHeight = lowerModules[0].dimensions.height;
      } else if (upperModules.length > 0) {
        // 상부장만 있는 경우
        totalHeight = upperModules.reduce((sum, m) => sum + m.dimensions.height, 0);
      } else if (rightModules.length > 0) {
        // 우측장만 있는 경우
        totalHeight = rightModules[0].dimensions.height;
      } else {
        // 기본값
        totalHeight = 700;
      }
      
      // 깊이는 가장 깊은 모듈의 깊이 사용
      const allModules = [...lowerModules, ...upperModules, ...rightModules];
      const maxDepth = allModules.length > 0
        ? Math.max(...allModules.map(m => m.dimensions.depth))
        : 550;
      
      // 통합 치수 설정 (최대 크기 제한)
      setUnifiedDimensions({
        width: Math.min(totalWidth, 1200),
        height: Math.min(totalHeight, 2400),
        depth: Math.min(maxDepth, 1000)
      });
      
      // 통합 모드 활성화 시 모든 모듈의 패널 두께를 18mm로 설정
      const updatedModules = moduleState.modules.map(module => ({
        ...module,
        panelThickness: 18
      }));
      
      updateModuleState({
        ...moduleState,
        modules: updatedModules
      });
    }
    
    setIsIntegrated(!isIntegrated);
  };
  
  // 상위 수준 정보 변경 핸들러
  const handleChange = (e, field) => {
    const { value } = e.target
    updateModuleState({
      ...moduleState,
      [field]: value
    })
  }
  
  // 위치 선택 후 모듈 추가 핸들러
  const handleSelectPosition = (position) => {
    addModule(position)
    setShowPositionModal(false)
  }

  return (
    <form className="space-y-3 text-sm">
      <div className="flex justify-between items-center mb-2 border-b pb-1">
        <h2 className="text-base font-bold">모듈 입력 폼</h2>
        <button
          type="button"
          onClick={toggleIntegration}
          className={`text-xs px-2 py-1 rounded ${
            isIntegrated 
            ? 'bg-blue-500 text-white' 
            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          {isIntegrated ? '개별 제어' : '통합 제어'}
        </button>
      </div>
      
      {/* 통합 모드 슬라이더 */}
      {isIntegrated && (
        <div className="border rounded-lg p-2 mb-2 bg-blue-50">
          <h3 className="text-sm font-semibold mb-1 text-blue-700">통합 크기 제어</h3>
          <div className="text-xs text-blue-600 mb-2 bg-blue-100 p-1 rounded">
            <span className="font-medium">설명:</span> 이 슬라이더는 모든 모듈을 통합하여 전체 가구의 크기를 제어합니다.
            <br/>- 너비: 전체 가구의 너비를 조절합니다. 하부장과 우측장이 모두 있는 경우 적절한 비율로 분배됩니다.
            <br/>- 높이: 전체 가구의 높이를 조절합니다. 하부장과 상부장이 모두 있는 경우 적절한 비율로 분배됩니다.
            <br/>- 깊이: 모든 모듈의 깊이를 동일하게 조절합니다.
            <br/><span className="font-medium">최대 크기:</span> 너비 1200mm, 높이 2400mm, 깊이 1000mm
            <br/><span className="font-medium">참고:</span> 패널 두께는 18mm로 유지됩니다.
          </div>
          <div className="space-y-2">
            <div>
              <div className="flex justify-between items-center mb-0.5">
                <label className="text-xs font-medium text-gray-700">너비: {unifiedDimensions.width}mm</label>
                <span className="text-xs text-gray-500">{unifiedDimensions.width}mm</span>
              </div>
              <input
                type="range"
                min={300}
                max={1200}
                step={10}
                value={unifiedDimensions.width}
                onChange={(e) => handleUnifiedDimensionChange(e, 'width')}
                className="w-full h-1.5 bg-blue-200 rounded-full appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>300</span>
                <span>1200</span>
              </div>
            </div>
            <div>
              <div className="flex justify-between items-center mb-0.5">
                <label className="text-xs font-medium text-gray-700">높이: {unifiedDimensions.height}mm</label>
                <span className="text-xs text-gray-500">{unifiedDimensions.height}mm</span>
              </div>
              <input
                type="range"
                min={300}
                max={2400}
                step={10}
                value={unifiedDimensions.height}
                onChange={(e) => handleUnifiedDimensionChange(e, 'height')}
                className="w-full h-1.5 bg-blue-200 rounded-full appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>300</span>
                <span>2400</span>
              </div>
            </div>
            <div>
              <div className="flex justify-between items-center mb-0.5">
                <label className="text-xs font-medium text-gray-700">깊이: {unifiedDimensions.depth}mm</label>
                <span className="text-xs text-gray-500">{unifiedDimensions.depth}mm</span>
              </div>
              <input
                type="range"
                min={300}
                max={1000}
                step={10}
                value={unifiedDimensions.depth}
                onChange={(e) => handleUnifiedDimensionChange(e, 'depth')}
                className="w-full h-1.5 bg-blue-200 rounded-full appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>300</span>
                <span>1000</span>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* 하부장 설정 */}
      {moduleState.modules.filter(m => m.type === 'lower' && m.position !== 'right').map((module, index) => (
        <div key={module.id} className="border rounded-lg p-2 mb-2 bg-gray-50">
          <h3 className="text-sm font-semibold mb-1 text-gray-700">하부장</h3>
          <div className="grid grid-cols-3 gap-2 mb-2">
            <div>
              <label className="block font-medium mb-0.5 text-xs text-gray-700">너비</label>
              <input
                type="number"
                min={300}
                max={1200}
                step={50}
                className="w-full border border-gray-300 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                value={module.dimensions.width}
                onChange={e => handleModuleChange(e, module.id, 'dimensions', 'width')}
                disabled={isIntegrated}
              />
            </div>
            <div>
              <label className="block font-medium mb-0.5 text-xs text-gray-700">높이</label>
              <input
                type="number"
                min={300}
                max={2400}
                step={50}
                className="w-full border border-gray-300 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                value={module.dimensions.height}
                onChange={e => handleModuleChange(e, module.id, 'dimensions', 'height')}
                disabled={isIntegrated}
              />
            </div>
            <div>
              <label className="block font-medium mb-0.5 text-xs text-gray-700">깊이</label>
              <input
                type="number"
                min={300}
                max={700}
                step={50}
                className="w-full border border-gray-300 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                value={module.dimensions.depth}
                onChange={e => handleModuleChange(e, module.id, 'dimensions', 'depth')}
                disabled={isIntegrated}
              />
            </div>
          </div>
          <div className="mb-1">
            <label className="block font-medium mb-0.5 text-xs text-gray-700">선반 수량</label>
            <input
              type="number"
              min={0}
              max={10}
              className="w-full border border-gray-300 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
              value={module.shelves.count}
              onChange={e => handleModuleChange(e, module.id, 'shelves', 'count')}
            />
          </div>
        </div>
      ))}
      
      {/* 모달 컴포넌트는 유지 (필요 시에만 표시) */}
      <ModulePositionModal 
        isOpen={showPositionModal}
        onClose={() => setShowPositionModal(false)}
        onSelectPosition={handleSelectPosition}
      />
      
      {/* 상부장/우측장 모듈들 표시 */}
      {moduleState.modules.filter(m => m.type === 'upper' || m.position === 'right').map((module, index) => {
        // 모듈 위치에 따라 다른 타이틀 표시
        const moduleTitle = module.position === 'right' ? '우측장' : '상부장';
        const isRightModule = module.position === 'right';
        
        return (
          <div key={module.id} className="border rounded-lg p-2 mb-2 bg-gray-50">
            <h3 className="text-sm font-semibold mb-1 text-gray-700">{moduleTitle}</h3>
            <div className="grid grid-cols-3 gap-2 mb-2">
              <div>
                <label className="block font-medium mb-0.5 text-xs text-gray-700">너비</label>
                <input
                  type="number"
                  min={300}
                  max={1200}
                  step={50}
                  className={`w-full border border-gray-300 rounded px-1.5 py-1 text-xs ${
                    // 우측 모듈이 아니거나 fixedWidth가 true인 경우 disabled
                    !isRightModule || module.fixedWidth || isIntegrated ? 'bg-gray-100 cursor-not-allowed' : 'focus:outline-none focus:ring-1 focus:ring-blue-400'
                  }`}
                  value={module.dimensions.width}
                  onChange={e => handleModuleChange(e, module.id, 'dimensions', 'width')}
                  disabled={!isRightModule || module.fixedWidth || isIntegrated}
                />
                {module.fixedWidth && (
                  <p className="text-xs text-gray-500 mt-0.5">하부장 너비와 동일</p>
                )}
              </div>
              <div>
                <label className="block font-medium mb-0.5 text-xs text-gray-700">높이</label>
                <input
                  type="number"
                  min={300}
                  max={2400}
                  step={50}
                  className={`w-full border border-gray-300 rounded px-1.5 py-1 text-xs ${isRightModule || isIntegrated ? 'bg-gray-100 cursor-not-allowed' : 'focus:outline-none focus:ring-1 focus:ring-blue-400'}`}
                  value={module.dimensions.height}
                  onChange={e => handleModuleChange(e, module.id, 'dimensions', 'height')}
                  disabled={isRightModule || isIntegrated}
                />
              </div>
              <div>
                <label className="block font-medium mb-0.5 text-xs text-gray-700">깊이</label>
                <input
                  type="number"
                  min={300}
                  max={700}
                  step={50}
                  className="w-full border border-gray-300 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                  value={module.dimensions.depth}
                  onChange={e => handleModuleChange(e, module.id, 'dimensions', 'depth')}
                  disabled={isIntegrated}
                />
              </div>
            </div>
            <div className="mb-1">
              <label className="block font-medium mb-0.5 text-xs text-gray-700">선반 수량</label>
              <input
                type="number"
                min={0}
                max={10}
                className="w-full border border-gray-300 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                value={module.shelves.count}
                onChange={e => handleModuleChange(e, module.id, 'shelves', 'count')}
              />
            </div>
          </div>
        );
      })}
    </form>
  )
}

export default ModuleForm
