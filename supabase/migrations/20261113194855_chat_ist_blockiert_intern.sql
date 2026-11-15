-- ist_blockiert wird nur innerhalb anderer SECURITY-DEFINER-Funktionen gebraucht;
-- direkt aufrufbar würde es verraten, ob sich zwei fremde Nutzer blockiert haben.
revoke execute on function public.ist_blockiert(uuid, uuid) from authenticated;
