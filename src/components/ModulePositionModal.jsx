import React, { useState } from 'react'

const ModulePositionModal = ({ isOpen, onClose, onSelectPosition }) => {
  const [selectedPosition, setSelectedPosition] = useState('top')
  
  if (!isOpen) return null
  
  const handlePositionSelect = (position) => {
    setSelectedPosition(position)
  }
  
  const handleConfirm = () => {
    onSelectPosition(selectedPosition)
  }
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96 max-w-md shadow-lg">
        <h2 className="text-xl font-bold mb-4 border-b pb-2">모듈 추가 위치 선택</h2>
        
        <div className="space-y-4 mb-6">
          <label className="flex items-center space-x-3 p-3 border rounded hover:bg-gray-50 cursor-pointer">
            <input
              type="radio"
              name="position"
              value="top"
              defaultChecked
              onChange={() => handlePositionSelect('top')}
              className="h-5 w-5 text-blue-600"
            />
            <div className="ml-2">
              <div className="text-gray-800 font-medium">위에 쌓기</div>
              <div className="text-gray-500 text-sm">기존 모듈 위에 새로운 모듈을 쌓습니다</div>
            </div>
          </label>
          
          <label className="flex items-center space-x-3 p-3 border rounded hover:bg-gray-50 cursor-pointer">
            <input
              type="radio"
              name="position"
              value="right"
              onChange={() => handlePositionSelect('right')}
              className="h-5 w-5 text-blue-600"
            />
            <div className="ml-2">
              <div className="text-gray-800 font-medium">우측에 붙이기</div>
              <div className="text-gray-500 text-sm">기존 모듈의 우측에 새로운 모듈을 붙입니다</div>
            </div>
          </label>
        </div>
        
        <div className="flex justify-end space-x-2">
          <button 
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300" 
            onClick={onClose}
          >
            취소
          </button>
          <button 
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            onClick={handleConfirm}
          >
            선택
          </button>
        </div>
      </div>
    </div>
  )
}

export default ModulePositionModal 