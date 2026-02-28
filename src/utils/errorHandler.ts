export const translateError = (error: any): string => {
    if (!error) return 'Error desconocido';

    const msg = typeof error === 'string' ? error : (error.message || '');
    const lowerMsg = msg.toLowerCase();

    // Permisos / RLS
    if (lowerMsg.includes('violates row-level security policy')) {
        return 'No tienes permisos suficientes (tu rol actual no permite hacer esto).';
    }
    if (lowerMsg.includes('permission denied')) {
        return 'Permiso denegado al intentar acceder a la base de datos.';
    }

    // Restricciones de Base de Datos
    if (lowerMsg.includes('duplicate key value violates unique constraint')) {
        return 'Ya existe un registro idéntico con ese nombre o identificador.';
    }
    if (lowerMsg.includes('violates foreign key constraint')) {
        return 'No se puede procesar porque esta información está conectada a otras partes del sistema (ej. productos que la usan).';
    }
    if (lowerMsg.includes('violates not-null constraint')) {
        return 'Faltan campos obligatorios por llenar.';
    }

    // Red
    if (lowerMsg.includes('failed to fetch') || lowerMsg.includes('network error')) {
        return 'Error de red. Verifica tu conexión a internet.';
    }

    // Not found
    if (lowerMsg.includes('not found')) {
        return 'El registro solicitado no existe o ya fue eliminado.';
    }

    // Autenticación
    if (lowerMsg.includes('invalid login credentials')) {
        return 'Credenciales inválidas. Revisa tu correo o contraseña.';
    }
    if (lowerMsg.includes('user not found')) {
        return 'Usuario no encontrado.';
    }

    // Si no tenemos una traducción específica, retornamos el error original 
    // que de todas formas suele tener algo de contexto.
    return msg || 'Ha ocurrido un error inesperado.';
};
