-- записи з табличок мали англійські позначки режиму
UPDATE reports SET mode = 'подія' WHERE mode = 'event';
UPDATE reports SET mode = 'не було' WHERE mode = 'none';
