package com.cricketlegend.repository;

import com.cricketlegend.domain.PlayingArea;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import java.util.List;
import org.springframework.data.jpa.domain.Specification;

/** Criteria implementation of {@link PlayingAreaRepositoryCustom}; picked up by Spring Data through the Impl suffix. */
public class PlayingAreaRepositoryCustomImpl implements PlayingAreaRepositoryCustom {

    @PersistenceContext
    private EntityManager entityManager;

    @Override
    public List<String> findDistinctAddressValues(Specification<PlayingArea> spec, String addressAttribute) {
        CriteriaBuilder cb = entityManager.getCriteriaBuilder();
        CriteriaQuery<String> query = cb.createQuery(String.class);
        Root<PlayingArea> root = query.from(PlayingArea.class);
        Expression<String> value = cb.trim(root.get("address").<String>get(addressAttribute));
        Predicate notBlank = cb.greaterThan(cb.length(value), 0);
        Predicate matching = spec.toPredicate(root, query, cb);
        query.select(value).distinct(true).where(matching == null ? notBlank : cb.and(matching, notBlank));
        return entityManager.createQuery(query).getResultList();
    }
}
