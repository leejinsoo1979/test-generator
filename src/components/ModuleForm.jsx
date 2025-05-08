import React, { useState } from 'react'
import ModulePositionModal from './ModulePositionModal'

const panelOptions = [
  { value: 'melamine_white', label: '화이트 멜라민' },
  { value: 'melamine_oak', label: '오크 멜라민' },
  { value: 'mdf_painted', label: '도장 MDF' }
]

const ModuleForm = ({ moduleState, updateModuleState, resetModule, addModule, updateModule }) => {
  const [showPositionModal, setShowPositionModal] = useState(false)
  
  // 입력값 변경 핸들러 (특정 모듈의 특정 섹션 업데이트)
  const handleModuleChange = (e, moduleId, section, field) => {
    const { value, type, checked } = e.target
    const processedValue = type === 'number' ? parseFloat(value) : (type === 'checkbox' ? checked : value)
    
    const moduleToUpdate = moduleState.modules.find(m => m.id === moduleId);
    
    if (section) {
      const updatedSection = {
        ...moduleToUpdate[section],
        [field]: processedValue
      };
      
      updateModule(moduleId, {
        ...moduleToUpdate,
        [section]: updatedSection
      });
    } else {
      updateModule(moduleId, {
        ...moduleToUpdate,
        [field]: processedValue
      });
    }
  }
  
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
    <form className="space-y-6">
      <h2 className="text-xl font-bold mb-4 border-b pb-2">모듈 입력 폼</h2>
      <div className="mb-4">
        <label className="block font-medium mb-1 text-gray-700">모듈 이름</label>
        <input
          type="text"
          className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
          value={moduleState.name}
          onChange={e => handleChange(e, 'name')}
        />
      </div>
      <div className="mb-4">
        <label className="block font-medium mb-1 text-gray-700">모듈 유형</label>
        <select
          className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
          value={moduleState.type}
          onChange={e => handleChange(e, 'type')}
        >
          <option value="cabinet">캐비닛</option>
          <option value="drawer">서랍</option>
        </select>
      </div>
      
      {/* 하부장 설정 */}
      <div className="border rounded-lg p-4 mb-4 bg-gray-50">
        <h3 className="text-lg font-semibold mb-3 text-gray-700">하부장</h3>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block font-medium mb-1 text-gray-700">너비 (mm)</label>
            <input
              type="number"
              min={300}
              max={1200}
              step={50}
              className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={moduleState.modules.find(m => m.id === 'lower')?.dimensions.width}
              onChange={e => handleModuleChange(e, 'lower', 'dimensions', 'width')}
            />
          </div>
          <div>
            <label className="block font-medium mb-1 text-gray-700">높이 (mm)</label>
            <input
              type="number"
              min={300}
              max={2400}
              step={50}
              className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={moduleState.modules.find(m => m.id === 'lower')?.dimensions.height}
              onChange={e => handleModuleChange(e, 'lower', 'dimensions', 'height')}
            />
          </div>
          <div>
            <label className="block font-medium mb-1 text-gray-700">깊이 (mm)</label>
            <input
              type="number"
              min={300}
              max={700}
              step={50}
              className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={moduleState.modules.find(m => m.id === 'lower')?.dimensions.depth}
              onChange={e => handleModuleChange(e, 'lower', 'dimensions', 'depth')}
            />
          </div>
        </div>
        <div className="mb-4">
          <label className="block font-medium mb-1 text-gray-700">패널 두께 (mm)</label>
          <input
            type="number"
            min={12}
            max={25}
            className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
            value={moduleState.modules.find(m => m.id === 'lower')?.panelThickness}
            onChange={e => handleModuleChange(e, 'lower', null, 'panelThickness')}
          />
        </div>
        <div className="flex flex-wrap gap-4 mb-4">
          <label className="flex items-center gap-2 text-gray-700">
            <input 
              type="checkbox" 
              checked={moduleState.modules.find(m => m.id === 'lower')?.panels.hasTop} 
              onChange={e => handleModuleChange(e, 'lower', 'panels', 'hasTop')} 
            />상판
          </label>
          <label className="flex items-center gap-2 text-gray-700">
            <input 
              type="checkbox" 
              checked={moduleState.modules.find(m => m.id === 'lower')?.panels.hasBottom} 
              onChange={e => handleModuleChange(e, 'lower', 'panels', 'hasBottom')} 
            />하판
          </label>
          <label className="flex items-center gap-2 text-gray-700">
            <input 
              type="checkbox" 
              checked={moduleState.modules.find(m => m.id === 'lower')?.panels.hasLeft} 
              onChange={e => handleModuleChange(e, 'lower', 'panels', 'hasLeft')} 
            />좌측판
          </label>
          <label className="flex items-center gap-2 text-gray-700">
            <input 
              type="checkbox" 
              checked={moduleState.modules.find(m => m.id === 'lower')?.panels.hasRight} 
              onChange={e => handleModuleChange(e, 'lower', 'panels', 'hasRight')} 
            />우측판
          </label>
          <label className="flex items-center gap-2 text-gray-700">
            <input 
              type="checkbox" 
              checked={moduleState.modules.find(m => m.id === 'lower')?.panels.hasBack} 
              onChange={e => handleModuleChange(e, 'lower', 'panels', 'hasBack')} 
            />뒷판
          </label>
        </div>
        <div className="mb-4">
          <label className="block font-medium mb-1 text-gray-700">패널 재질</label>
          <select
            className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
            value={moduleState.modules.find(m => m.id === 'lower')?.material}
            onChange={e => handleModuleChange(e, 'lower', null, 'material')}
          >
            {panelOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div className="mb-4">
          <label className="block font-medium mb-1 text-gray-700">선반 수량</label>
          <input
            type="number"
            min={0}
            max={10}
            className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
            value={moduleState.modules.find(m => m.id === 'lower')?.shelves.count}
            onChange={e => handleModuleChange(e, 'lower', 'shelves', 'count')}
          />
        </div>
      </div>
      
      {/* 모듈 추가 버튼 - 하부장 바로 아래에 배치 */}
      <div className="mb-4">
        <button
          type="button"
          className="bg-blue-600 text-white rounded px-4 py-2 hover:bg-blue-700 transition flex items-center"
          onClick={() => setShowPositionModal(true)}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          모듈 추가
        </button>
      </div>
      
      {/* 모달 컴포넌트 */}
      <ModulePositionModal 
        isOpen={showPositionModal}
        onClose={() => setShowPositionModal(false)}
        onSelectPosition={handleSelectPosition}
      />
      
      {/* 상부장 모듈들 표시 */}
      {moduleState.modules.filter(m => m.id !== 'lower').map((module, index) => {
        // 모듈 위치에 따라 다른 타이틀 표시
        const moduleTitle = module.position === 'right' ? '우측장' : '상부장';
        const isRightModule = module.position === 'right';
        
        return (
          <div key={module.id} className="border rounded-lg p-4 mb-4 bg-gray-50">
            <h3 className="text-lg font-semibold mb-3 text-gray-700">{moduleTitle} {index + 1}</h3>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block font-medium mb-1 text-gray-700">너비 (mm)</label>
                <input
                  type="number"
                  min={300}
                  max={1200}
                  step={50}
                  className={`w-full border border-gray-300 rounded px-3 py-2 ${
                    // 우측 모듈이 아니거나 fixedWidth가 true인 경우 disabled
                    !isRightModule || module.fixedWidth ? 'bg-gray-100 cursor-not-allowed' : 'focus:outline-none focus:ring-2 focus:ring-blue-400'
                  }`}
                  value={module.dimensions.width}
                  onChange={e => handleModuleChange(e, module.id, 'dimensions', 'width')}
                  disabled={!isRightModule || module.fixedWidth}
                />
                {module.fixedWidth && (
                  <p className="text-xs text-gray-500 mt-1">여러 하부 모듈의 너비 합산값이 자동 적용됨</p>
                )}
              </div>
              <div>
                <label className="block font-medium mb-1 text-gray-700">높이 (mm)</label>
                <input
                  type="number"
                  min={300}
                  max={2400}
                  step={50}
                  className={`w-full border border-gray-300 rounded px-3 py-2 ${isRightModule ? 'bg-gray-100 cursor-not-allowed' : 'focus:outline-none focus:ring-2 focus:ring-blue-400'}`}
                  value={module.dimensions.height}
                  onChange={e => handleModuleChange(e, module.id, 'dimensions', 'height')}
                  disabled={isRightModule}
                />
              </div>
              <div>
                <label className="block font-medium mb-1 text-gray-700">깊이 (mm)</label>
                <input
                  type="number"
                  className="w-full border border-gray-300 rounded px-3 py-2 bg-gray-100 cursor-not-allowed"
                  value={module.dimensions.depth}
                  disabled
                />
              </div>
            </div>
            <div className="mb-4">
              <label className="block font-medium mb-1 text-gray-700">패널 두께 (mm)</label>
              <input
                type="number"
                min={12}
                max={25}
                className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={module.panelThickness}
                onChange={e => handleModuleChange(e, module.id, null, 'panelThickness')}
              />
            </div>
            <div className="flex flex-wrap gap-4 mb-4">
              <label className="flex items-center gap-2 text-gray-700">
                <input 
                  type="checkbox" 
                  checked={module.panels.hasTop} 
                  onChange={e => handleModuleChange(e, module.id, 'panels', 'hasTop')} 
                />상판
              </label>
              <label className="flex items-center gap-2 text-gray-700">
                <input 
                  type="checkbox" 
                  checked={module.panels.hasBottom} 
                  onChange={e => handleModuleChange(e, module.id, 'panels', 'hasBottom')} 
                />하판
              </label>
              <label className={`flex items-center gap-2 text-gray-700 ${isRightModule ? 'opacity-50' : ''}`}>
                <input 
                  type="checkbox" 
                  checked={module.panels.hasLeft} 
                  onChange={e => handleModuleChange(e, module.id, 'panels', 'hasLeft')} 
                  disabled={isRightModule}
                />좌측판
              </label>
              <label className="flex items-center gap-2 text-gray-700">
                <input 
                  type="checkbox" 
                  checked={module.panels.hasRight} 
                  onChange={e => handleModuleChange(e, module.id, 'panels', 'hasRight')} 
                />우측판
              </label>
              <label className="flex items-center gap-2 text-gray-700">
                <input 
                  type="checkbox" 
                  checked={module.panels.hasBack} 
                  onChange={e => handleModuleChange(e, module.id, 'panels', 'hasBack')} 
                />뒷판
              </label>
            </div>
            <div className="mb-4">
              <label className="block font-medium mb-1 text-gray-700">패널 재질</label>
              <select
                className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={module.material}
                onChange={e => handleModuleChange(e, module.id, null, 'material')}
              >
                {panelOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="mb-4">
              <label className="block font-medium mb-1 text-gray-700">선반 수량</label>
              <input
                type="number"
                min={0}
                max={10}
                className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={module.shelves.count}
                onChange={e => handleModuleChange(e, module.id, 'shelves', 'count')}
              />
            </div>
          </div>
        );
      })}
      
      <div className="flex gap-2 mt-4">
        <button type="button" className="bg-gray-200 text-gray-700 rounded px-4 py-2 hover:bg-gray-300 transition" onClick={resetModule}>초기화</button>
      </div>
    </form>
  )
}

export default ModuleForm
