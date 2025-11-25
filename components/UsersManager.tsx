import React, { useEffect, useState } from 'react';
import { getAllUsers, getAllDepartments, createUser, updateUser } from '@/app/actions/users';

export const UsersManager = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [allDepts, setAllDepts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Estado del Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null); // null = creando nuevo
  
  // Formulario
  const [formData, setFormData] = useState({
      fullName: '',
      email: '',
      password: '',
      role: 'USER',
      departmentIds: [] as string[]
  });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
      setIsLoading(true);
      const [usersData, deptsData] = await Promise.all([getAllUsers(), getAllDepartments()]);
      if (usersData.authorized) setUsers(usersData.users);
      setAllDepts(deptsData);
      setIsLoading(false);
  };

  const handleOpenCreate = () => {
      setEditingUser(null);
      setFormData({ fullName: '', email: '', password: '', role: 'USER', departmentIds: [] });
      setIsModalOpen(true);
  };

  const handleOpenEdit = (user: any) => {
      setEditingUser(user);
      setFormData({
          fullName: user.name,
          email: user.email,
          password: '', // No mostramos password
          role: user.role,
          departmentIds: user.departments.map((d: any) => d.id)
      });
      setIsModalOpen(true);
  };

  const handleToggleDept = (deptId: string) => {
      setFormData(prev => {
          const exists = prev.departmentIds.includes(deptId);
          if (exists) return { ...prev, departmentIds: prev.departmentIds.filter(id => id !== deptId) };
          return { ...prev, departmentIds: [...prev.departmentIds, deptId] };
      });
  };

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsLoading(true);
      
      let res;
      if (editingUser) {
          // Editar (ignora password si está vacío)
          res = await updateUser(editingUser.id, formData);
      } else {
          // Crear
          if (!formData.password) return alert("Contraseña requerida");
          res = await createUser(formData);
      }

      if (res.success) {
          setIsModalOpen(false);
          loadData();
      } else {
          alert("Error: " + res.error);
          setIsLoading(false);
      }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold text-gray-800">Gestión de Usuarios</h1>
          <button 
            onClick={handleOpenCreate}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2"
          >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Nuevo Usuario
          </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-gray-700 font-semibold border-b border-gray-200">
                  <tr>
                      <th className="p-4">Nombre</th>
                      <th className="p-4">Email</th>
                      <th className="p-4">Rol</th>
                      <th className="p-4">Departamentos Asignados</th>
                      <th className="p-4 text-right">Acciones</th>
                  </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                  {users.map(user => (
                      <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                          <td className="p-4 font-medium text-gray-900">{user.name}</td>
                          <td className="p-4">{user.email}</td>
                          <td className="p-4">
                              <span className={`px-2 py-1 rounded-full text-xs font-bold ${user.role === 'SUPERADMIN' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>
                                  {user.role}
                              </span>
                          </td>
                          <td className="p-4">
                              <div className="flex flex-wrap gap-1">
                                  {user.departments.map((d: any) => (
                                      <span key={d.id} className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs border border-blue-100">
                                          {d.name.replace('Departamento ', '')}
                                      </span>
                                  ))}
                                  {user.departments.length === 0 && <span className="text-gray-400 text-xs">- Ninguno -</span>}
                              </div>
                          </td>
                          <td className="p-4 text-right">
                              <button 
                                onClick={() => handleOpenEdit(user)}
                                className="text-indigo-600 hover:text-indigo-800 font-medium text-sm"
                              >
                                  Editar
                              </button>
                          </td>
                      </tr>
                  ))}
              </tbody>
          </table>
          {users.length === 0 && !isLoading && (
              <div className="p-8 text-center text-gray-400">No se encontraron usuarios.</div>
          )}
      </div>

      {/* MODAL */}
      {isModalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 animate-fade-in-up">
                  <h2 className="text-xl font-bold mb-4 text-gray-800">
                      {editingUser ? 'Editar Usuario' : 'Crear Usuario'}
                  </h2>
                  
                  <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-xs font-bold text-gray-500 mb-1">Nombre Completo</label>
                              <input 
                                  required
                                  type="text" 
                                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                                  value={formData.fullName}
                                  onChange={e => setFormData({...formData, fullName: e.target.value})}
                                  disabled={!!editingUser} // Nombre no editable (opcional)
                              />
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-gray-500 mb-1">Rol</label>
                              <select 
                                  className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white"
                                  value={formData.role}
                                  onChange={e => setFormData({...formData, role: e.target.value})}
                              >
                                  <option value="USER">Empleado</option>
                                  <option value="SUPERADMIN">Administrador</option>
                              </select>
                          </div>
                      </div>

                      <div>
                          <label className="block text-xs font-bold text-gray-500 mb-1">Email</label>
                          <input 
                              required
                              type="email" 
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none disabled:bg-gray-100"
                              value={formData.email}
                              onChange={e => setFormData({...formData, email: e.target.value})}
                              disabled={!!editingUser} 
                          />
                      </div>

                      {!editingUser && (
                          <div>
                              <label className="block text-xs font-bold text-gray-500 mb-1">Contraseña</label>
                              <input 
                                  required
                                  type="password" 
                                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                                  value={formData.password}
                                  onChange={e => setFormData({...formData, password: e.target.value})}
                              />
                          </div>
                      )}

                      <div>
                          <label className="block text-xs font-bold text-gray-500 mb-2">Asignar Departamentos</label>
                          <div className="border border-gray-200 rounded-lg p-3 max-h-40 overflow-y-auto grid grid-cols-2 gap-2 bg-gray-50">
                              {allDepts.map(dept => (
                                  <label key={dept.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 p-1 rounded">
                                      <input 
                                          type="checkbox"
                                          checked={formData.departmentIds.includes(dept.id)}
                                          onChange={() => handleToggleDept(dept.id)}
                                          className="rounded text-indigo-600 focus:ring-indigo-500"
                                      />
                                      <span className="text-sm text-gray-700">{dept.name.replace('Departamento ', '')}</span>
                                  </label>
                              ))}
                          </div>
                      </div>

                      <div className="flex justify-end gap-3 mt-6">
                          <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium">Cancelar</button>
                          <button type="submit" className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium shadow-sm">
                              {editingUser ? 'Guardar Cambios' : 'Crear Usuario'}
                          </button>
                      </div>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
};